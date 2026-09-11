import { createAuth } from "@ppal/auth";
import { env } from "@ppal/env/server";
import { initLogger } from "evlog";
import { createAuthMiddleware } from "evlog/better-auth";
import type { BetterAuthInstance } from "evlog/better-auth";
import { evlog } from "evlog/hono";
import type { EvlogVariables } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { createAnalyticsRoutes } from "./routes/analytics";
import { createBillingRoutes } from "./routes/billing";
import { createCatalogRoutes } from "./routes/catalog";
import { createCommunityRoutes } from "./routes/community";
import { createHistoricalImportRoutes } from "./routes/historical-imports";
import { createNotificationRoutes } from "./routes/notifications";
import { createOperationRoutes } from "./routes/operations";
import { createReferralRoutes } from "./routes/referrals";
import { createTicketRoutes } from "./routes/tickets";
import { createUploadRoutes } from "./routes/uploads";
import {
  markExtractionTerminalFailure,
  processExtractionMessage,
} from "./services/extraction";
import {
  processExpoPushReceipts,
  processNotificationMessage,
} from "./services/notifications";
import { recordOperationFailure } from "./services/operations";
import { synchronizeSportsCatalog } from "./services/schedules";
import {
  enqueueDueSportsEvents,
  processSportsMessage,
} from "./services/sports";

initLogger({ env: { service: "ppal-api" } });

const auth = createAuth();
const app = new Hono<EvlogVariables>();

app.use(evlog());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    origin: env.CORS_ORIGIN,
  })
);
app.use("*", async (c, next) => {
  const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
    exclude: ["/api/auth/**", "/health"],
    maskEmail: true,
  });
  await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
  return next();
});
app.use("/api/v1/*", async (c, next) => {
  if (c.req.path.startsWith("/api/v1/webhooks/")) {
    return await next();
  }
  const clientKey = c.req.header("cf-connecting-ip") ?? "local";
  const isUploadMutation =
    c.req.method !== "GET" &&
    (c.req.path.includes("/uploads") ||
      c.req.path.includes("/historical-imports"));
  const limiter = isUploadMutation ? env.UPLOAD_RATE_LIMIT : env.API_RATE_LIMIT;
  if (limiter?.limit) {
    const { success } = await limiter.limit({
      key: `${clientKey}:${isUploadMutation ? "upload" : "api"}`,
    });
    if (!success) {
      return c.json({ code: "RATE_LIMITED", error: "Too many requests" }, 429, {
        "retry-after": "60",
      });
    }
  }
  return await next();
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const routes = app
  .get("/health", (c) =>
    c.json({
      service: "ppal-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    })
  )
  .get("/api/v1/ping", (c) => c.json({ ok: true }))
  .route("/api/v1/uploads", createUploadRoutes(auth))
  .route("/api/v1/tickets", createTicketRoutes(auth))
  .route("/api/v1", createHistoricalImportRoutes(auth))
  .route("/api/v1", createReferralRoutes(auth))
  .route("/api/v1", createOperationRoutes())
  .route("/api/v1", createBillingRoutes(auth))
  .route("/api/v1", createCommunityRoutes(auth))
  .route("/api/v1", createNotificationRoutes(auth))
  .route("/api/v1", createAnalyticsRoutes(auth))
  .route("/api/v1", createCatalogRoutes(auth));

app.notFound((c) => c.json({ code: "NOT_FOUND", error: "Not found" }, 404));
// Hono requires an error callback to preserve its typed response surface.
// oxlint-disable-next-line prefer-await-to-callbacks
app.onError((error, c) => {
  c.get("log").error(error, { event: "request.failed" });
  return c.json(
    { code: "INTERNAL_ERROR", error: "Internal server error" },
    500
  );
});

export type AppType = typeof routes;

const queue = async (batch: MessageBatch, workerEnv: Env): Promise<void> => {
  const pending: Promise<void>[] = [];
  for (const message of batch.messages) {
    pending.push(
      (async () => {
        try {
          if (batch.queue.includes("extraction")) {
            await processExtractionMessage(message.body, workerEnv);
            message.ack();
            return;
          }
          if (batch.queue.includes("notification")) {
            await processNotificationMessage(message.body, workerEnv);
            message.ack();
            return;
          }
          if (batch.queue.includes("sports")) {
            await processSportsMessage(message.body, workerEnv);
            message.ack();
            return;
          }
          throw new Error(`No consumer registered for queue ${batch.queue}`);
        } catch (error) {
          if (batch.queue.includes("extraction") && message.attempts >= 5) {
            await markExtractionTerminalFailure(message.body, workerEnv, error);
          }
          if (message.attempts >= 5) {
            await recordOperationFailure({
              attempts: message.attempts,
              body: message.body,
              error,
              messageId: message.id,
              queue: batch.queue,
              workerEnv,
            });
          }
          console.error(
            JSON.stringify({
              error:
                error instanceof Error ? error.message : "Unknown queue error",
              event: "queue.message_failed",
              messageId: message.id,
              queue: batch.queue,
            })
          );
          message.retry();
        }
      })()
    );
  }
  await Promise.all(pending);
};

const scheduled = async (
  controller: ScheduledController,
  workerEnv: Env
): Promise<void> => {
  const catalog = await workerEnv.DB.prepare(
    "SELECT COUNT(*) AS count FROM sports"
  ).first<{ count: number }>();
  if (controller.cron !== "*/1 * * * *" || (catalog?.count ?? 0) === 0) {
    await synchronizeSportsCatalog(workerEnv);
  }
  await enqueueDueSportsEvents(workerEnv);
  const staleBefore = Date.now() - 10 * 60 * 1000;
  const stale = await workerEnv.DB.prepare(
    `UPDATE uploads SET status = 'ready', updated_at = ?
     WHERE status = 'processing' AND updated_at < ? RETURNING id`
  )
    .bind(Date.now(), staleBefore)
    .all<{ id: string }>();
  const ready = await workerEnv.DB.prepare(
    "SELECT id FROM uploads WHERE status = 'ready' ORDER BY updated_at LIMIT 100"
  ).all<{ id: string }>();
  const extractionIds = new Set([
    ...stale.results.map(({ id }) => id),
    ...ready.results.map(({ id }) => id),
  ]);
  if (extractionIds.size > 0) {
    await workerEnv.EXTRACTION_QUEUE.sendBatch(
      [...extractionIds].map((id) => ({
        body: {
          attemptVersion: 1,
          requestedAt: new Date().toISOString(),
          uploadId: id,
        },
        contentType: "json" as const,
      }))
    );
  }
  const pendingDeliveries = await workerEnv.DB.prepare(
    `SELECT id FROM notification_deliveries
     WHERE status IN ('pending', 'failed') AND attempts < 10
     ORDER BY updated_at LIMIT 100`
  ).all<{ id: string }>();
  if (pendingDeliveries.results.length > 0) {
    await workerEnv.NOTIFICATION_QUEUE.sendBatch(
      pendingDeliveries.results.map(({ id }) => ({
        body: { deliveryId: id },
        contentType: "json" as const,
      }))
    );
  }
  await processExpoPushReceipts(workerEnv);
};

export default {
  fetch: app.fetch,
  queue,
  scheduled,
} satisfies ExportedHandler<Env>;
