/* oxlint-disable no-await-in-loop -- Recovery mutates durable state before each corresponding replay. */

import { zValidator } from "@hono/zod-validator";
import {
  extractionQueueMessageSchema,
  notificationQueueMessageSchema,
  sportsPollQueueMessageSchema,
} from "@ppal/contracts/queues";
import { env } from "@ppal/env/server";
import { Hono } from "hono";
import { z } from "zod";

import { hasOperationsAccess } from "../lib/operations-auth";

const legacyUserSchema = z.object({
  createdAt: z.string().datetime().optional(),
  email: z.string().email(),
  emailVerified: z.boolean().default(false),
  legacyId: z.union([z.string(), z.number()]).transform(String),
  name: z.string().trim().min(1).max(255),
  passwordHash: z.string().min(20),
  username: z.string().trim().min(3).max(30).optional(),
});

const legacyMigrationSchema = z.object({
  source: z.string().trim().min(1).max(80).default("laravel"),
  users: z.array(legacyUserSchema).min(1).max(100),
});

const replaySchema = z.object({
  failureIds: z.array(z.string()).min(1).max(100),
});

const authGuard = async (
  c: Parameters<Parameters<Hono["use"]>[1]>[0],
  next: () => Promise<void>
) => {
  if (!hasOperationsAccess(c.req.raw, env.BETTER_AUTH_SECRET)) {
    return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
  }
  return await next();
};

export const createOperationRoutes = () => {
  const app = new Hono();
  app.use("*", authGuard);
  return app
    .get("/operations/health", async (c) => {
      const [failures, stuckUploads, staleLeases] = await env.DB.batch([
        env.DB.prepare(
          "SELECT COUNT(*) AS count FROM operation_failures WHERE status = 'failed'"
        ),
        env.DB.prepare(
          "SELECT COUNT(*) AS count FROM uploads WHERE status = 'processing' AND updated_at < ?"
        ).bind(Date.now() - 10 * 60 * 1000),
        env.DB.prepare(
          "SELECT COUNT(*) AS count FROM sports_events WHERE poll_lease_until IS NOT NULL AND poll_lease_until < ?"
        ).bind(Date.now()),
      ]);
      return c.json({
        failures: Number(
          (failures?.results?.[0] as { count?: number } | undefined)?.count ?? 0
        ),
        staleSportsLeases: Number(
          (staleLeases?.results?.[0] as { count?: number } | undefined)
            ?.count ?? 0
        ),
        stuckUploads: Number(
          (stuckUploads?.results?.[0] as { count?: number } | undefined)
            ?.count ?? 0
        ),
      });
    })
    .get("/operations/failures", async (c) => {
      const rows = await env.DB.prepare(
        `SELECT attempts, created_at, error_message, id, message_id, payload, queue, replayed_at, status, updated_at
         FROM operation_failures ORDER BY created_at DESC LIMIT 200`
      ).all<{
        attempts: number;
        created_at: number;
        error_message: string;
        id: string;
        message_id: string;
        payload: string;
        queue: string;
        replayed_at: number | null;
        status: string;
        updated_at: number;
      }>();
      return c.json({
        failures: rows.results.map((row) => ({
          attempts: row.attempts,
          createdAt: new Date(row.created_at).toISOString(),
          error: row.error_message,
          id: row.id,
          messageId: row.message_id,
          payload: JSON.parse(row.payload) as unknown,
          queue: row.queue,
          replayedAt: row.replayed_at
            ? new Date(row.replayed_at).toISOString()
            : null,
          status: row.status,
          updatedAt: new Date(row.updated_at).toISOString(),
        })),
      });
    })
    .post(
      "/operations/failures/replay",
      zValidator("json", replaySchema),
      async (c) => {
        const input = c.req.valid("json");
        const placeholders = input.failureIds.map(() => "?").join(",");
        const rows = await env.DB.prepare(
          `SELECT id, payload, queue FROM operation_failures WHERE id IN (${placeholders}) AND status = 'failed'`
        )
          .bind(...input.failureIds)
          .all<{ id: string; payload: string; queue: string }>();
        const replayed: string[] = [];
        for (const row of rows.results) {
          const payload = JSON.parse(row.payload) as unknown;
          if (row.queue.includes("extraction")) {
            const extraction = extractionQueueMessageSchema.safeParse(payload);
            if (!extraction.success) {
              continue;
            }
            await env.DB.batch([
              env.DB.prepare(
                "UPDATE uploads SET status = 'ready', updated_at = ? WHERE id = ? AND status = 'failed'"
              ).bind(Date.now(), extraction.data.uploadId),
              env.DB.prepare(
                `UPDATE usage_events SET status = 'reserved', updated_at = ?
                 WHERE resource_id = ? AND status = 'released'`
              ).bind(Date.now(), extraction.data.uploadId),
            ]);
            await env.EXTRACTION_QUEUE.send(extraction.data, {
              contentType: "json",
            });
          } else if (row.queue.includes("notification")) {
            const notification =
              notificationQueueMessageSchema.safeParse(payload);
            if (!notification.success) {
              continue;
            }
            await env.NOTIFICATION_QUEUE.send(notification.data, {
              contentType: "json",
            });
          } else if (row.queue.includes("sports")) {
            const sports = sportsPollQueueMessageSchema.safeParse(payload);
            if (!sports.success) {
              continue;
            }
            const leaseToken = String(Date.now() + 60_000);
            const lease = await env.DB.prepare(
              `UPDATE sports_events SET poll_lease_until = ?, updated_at = ?
               WHERE id = ? AND status IN ('scheduled', 'live')`
            )
              .bind(Number(leaseToken), Date.now(), sports.data.eventId)
              .run();
            if (lease.meta.changes === 0) {
              continue;
            }
            await env.SPORTS_QUEUE.send(
              { eventId: sports.data.eventId, leaseToken },
              { contentType: "json" }
            );
          } else {
            continue;
          }
          replayed.push(row.id);
        }
        if (replayed.length > 0) {
          const replayPlaceholders = replayed.map(() => "?").join(",");
          await env.DB.prepare(
            `UPDATE operation_failures SET replayed_at = ?, status = 'replayed', updated_at = ? WHERE id IN (${replayPlaceholders})`
          )
            .bind(Date.now(), Date.now(), ...replayed)
            .run();
        }
        return c.json({ replayed });
      }
    )
    .post("/operations/recover-stale", async (c) => {
      const now = Date.now();
      const [uploads, events] = await env.DB.batch([
        env.DB.prepare(
          "UPDATE uploads SET status = 'ready', updated_at = ? WHERE status = 'processing' AND updated_at < ? RETURNING id"
        ).bind(now, now - 10 * 60 * 1000),
        env.DB.prepare(
          "UPDATE sports_events SET poll_lease_until = NULL, next_poll_at = ?, updated_at = ? WHERE poll_lease_until IS NOT NULL AND poll_lease_until < ? RETURNING id"
        ).bind(now, now, now),
      ]);
      return c.json({
        recoveredEvents: events?.results?.length ?? 0,
        recoveredUploads: uploads?.results?.length ?? 0,
      });
    })
    .post(
      "/operations/migrations/laravel/users",
      zValidator("json", legacyMigrationSchema),
      async (c) => {
        const input = c.req.valid("json");
        let imported = 0;
        let skipped = 0;
        for (const legacyUser of input.users) {
          const receipt = await env.DB.prepare(
            "SELECT target_id FROM migration_receipts WHERE source = ? AND target_type = 'user' AND source_id = ?"
          )
            .bind(input.source, legacyUser.legacyId)
            .first<{ target_id: string }>();
          if (receipt) {
            skipped += 1;
            continue;
          }
          const existing = await env.DB.prepare(
            "SELECT id FROM user WHERE lower(email) = lower(?)"
          )
            .bind(legacyUser.email)
            .first<{ id: string }>();
          const userId = existing?.id ?? crypto.randomUUID();
          const now = Date.now();
          if (!existing) {
            await env.DB.batch([
              env.DB.prepare(
                `INSERT INTO user (created_at, email, email_verified, id, name, updated_at)
               VALUES (?, lower(?), ?, ?, ?, ?)`
              ).bind(
                legacyUser.createdAt
                  ? new Date(legacyUser.createdAt).getTime()
                  : now,
                legacyUser.email,
                Number(legacyUser.emailVerified),
                userId,
                legacyUser.name,
                now
              ),
              env.DB.prepare(
                `INSERT INTO account (account_id, created_at, id, issuer, password, provider_id, updated_at, user_id)
               VALUES (?, ?, ?, 'credential', ?, 'credential', ?, ?)`
              ).bind(
                userId,
                now,
                crypto.randomUUID(),
                legacyUser.passwordHash.replace(/^\$2y\$/u, "$2b$"),
                now,
                userId
              ),
            ]);
          }
          if (legacyUser.username) {
            await env.DB.prepare(
              `INSERT INTO profiles (updated_at, user_id, username) VALUES (?, ?, ?)
             ON CONFLICT(user_id) DO NOTHING`
            )
              .bind(now, userId, legacyUser.username.toLowerCase())
              .run();
          }
          await env.DB.prepare(
            `INSERT INTO migration_receipts (id, source, source_id, target_id, target_type)
           VALUES (?, ?, ?, ?, 'user')`
          )
            .bind(
              crypto.randomUUID(),
              input.source,
              legacyUser.legacyId,
              userId
            )
            .run();
          imported += 1;
        }
        return c.json({ imported, skipped });
      }
    );
};
