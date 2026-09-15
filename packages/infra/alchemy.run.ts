/* oxlint-disable func-names, sort-keys -- Resources are ordered by lifecycle and binding role. */

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import type { CommunityChannelRoom } from "../../apps/server/src/durable-objects/community-channel-room";
import type { SportradarProductBudget } from "../../apps/server/src/durable-objects/sportradar-product-budget";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

const pullRequestNumber = process.env.PR_NUMBER?.trim();
const isPullRequest = /^\d+$/u.test(pullRequestNumber ?? "");
const deploymentSuffix = isPullRequest ? `-pr-${pullRequestNumber}` : "";
const rateLimitNamespaceOffset = isPullRequest
  ? 10_000 + Number(pullRequestNumber) * 10
  : 0;
const apiDomain = isPullRequest
  ? `api-pr-${pullRequestNumber}.myparlaypal.com`
  : "api.myparlaypal.com";
const webDomain = isPullRequest
  ? `pr-${pullRequestNumber}.myparlaypal.com`
  : "myparlaypal.com";
const publicServerUrl = `https://${apiDomain}`;

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

export const uploads = Cloudflare.R2.Bucket("uploads", {
  lifecycleRules: [
    {
      deleteObjectsTransition: {
        condition: { maxAge: 90 * 24 * 60 * 60, type: "Age" },
      },
      id: "expire-uploaded-slips",
    },
  ],
  publicAccess: false,
});

export const avatars = Cloudflare.R2.Bucket("avatars", {
  publicAccess: false,
});

export const extractionQueue = Cloudflare.Queues.Queue("extraction-queue");
export const extractionDeadLetterQueue = Cloudflare.Queues.Queue(
  "extraction-dead-letter-queue"
);
export const sportsQueue = Cloudflare.Queues.Queue("sports-poll-queue");
export const sportsDeadLetterQueue = Cloudflare.Queues.Queue(
  "sports-poll-dead-letter-queue"
);
export const notificationQueue = Cloudflare.Queues.Queue("notification-queue");
export const notificationDeadLetterQueue = Cloudflare.Queues.Queue(
  "notification-dead-letter-queue"
);
export const analytics = Cloudflare.AnalyticsEngine.Dataset("analytics", {
  dataset: "ppal_events",
});

export const server = Cloudflare.Worker("server", {
  compatibility: {
    date: "2026-09-10",
    flags: ["nodejs_compat"],
  },
  crons: ["*/1 * * * *", "5 */6 * * *"],
  dev: {
    port: 3000,
  },
  // Existing DNS records are managed outside Alchemy. A zone route lets the
  // Worker serve the proxied hostname without trying to replace those records
  // with a custom domain.
  routes: [{ pattern: `${apiDomain}/*` }],
  env: {
    ANALYTICS: analytics,
    API_RATE_LIMIT: Cloudflare.RateLimit("api-rate-limit", {
      namespaceId: rateLimitNamespaceOffset + 1001,
      simple: { limit: 120, period: 60 },
    }),
    COMMUNITY_HTTP_RATE_LIMIT: Cloudflare.RateLimit(
      "community-http-rate-limit",
      {
        namespaceId: rateLimitNamespaceOffset + 1006,
        simple: { limit: 120, period: 60 },
      }
    ),
    COMMUNITY_CHAT_RATE_LIMIT: Cloudflare.RateLimit(
      "community-chat-rate-limit",
      {
        namespaceId: rateLimitNamespaceOffset + 1007,
        simple: { limit: 60, period: 60 },
      }
    ),
    COMMUNITY_CHANNEL_ROOMS: Cloudflare.DurableObject<CommunityChannelRoom>(
      "COMMUNITY_CHANNEL_ROOMS",
      { className: "CommunityChannelRoom" }
    ),
    AUTH_RATE_LIMIT: Cloudflare.RateLimit("auth-rate-limit", {
      namespaceId: rateLimitNamespaceOffset + 1003,
      simple: { limit: 30, period: 60 },
    }),
    APPLE_CLIENT_ID: Config.string("APPLE_CLIENT_ID").pipe(
      Config.withDefault("")
    ),
    APPLE_CLIENT_SECRET: Config.redacted("APPLE_CLIENT_SECRET").pipe(
      Config.withDefault(Redacted.make(""))
    ),
    BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Config.string("BETTER_AUTH_URL").pipe(
      Config.withDefault(publicServerUrl)
    ),
    CORS_ORIGIN: isPullRequest
      ? `https://${webDomain}`
      : Config.string("CORS_ORIGIN").pipe(
          Config.withDefault("https://myparlaypal.com")
        ),
    DB: db,
    EXTRACTION_QUEUE: extractionQueue,
    GEMINI_API_KEY: Config.redacted("GEMINI_API_KEY"),
    GOOGLE_CLIENT_ID: Config.string("GOOGLE_CLIENT_ID").pipe(
      Config.withDefault("")
    ),
    GOOGLE_CLIENT_SECRET: Config.redacted("GOOGLE_CLIENT_SECRET").pipe(
      Config.withDefault(Redacted.make(""))
    ),
    NOTIFICATION_QUEUE: notificationQueue,
    OPERATIONS_API_TOKEN: Config.redacted("OPERATIONS_API_TOKEN"),
    OPERATIONS_RATE_LIMIT: Cloudflare.RateLimit("operations-rate-limit", {
      namespaceId: rateLimitNamespaceOffset + 1005,
      simple: { limit: 20, period: 60 },
    }),
    R2_AVATARS: avatars,
    R2_UPLOADS: uploads,
    RESEND_API_KEY: Config.redacted("RESEND_API_KEY").pipe(
      Config.withDefault(Redacted.make(""))
    ),
    RESEND_FROM_EMAIL: Config.string("RESEND_FROM_EMAIL").pipe(
      Config.withDefault("support@myparlaypal.com")
    ),
    REVENUECAT_WEBHOOK_SECRET: Config.redacted("REVENUECAT_WEBHOOK_SECRET"),
    SERVER_BUILD: Config.string("GITHUB_SHA").pipe(Config.withDefault("local")),
    SPORTRADAR_API_KEY: Config.redacted("SPORTRADAR_API_KEY"),
    SPORTRADAR_ACCESS_LEVEL: Config.string("SPORTRADAR_ACCESS_LEVEL").pipe(
      Config.withDefault("trial")
    ),
    SPORTRADAR_PRODUCT_BUDGET:
      Cloudflare.DurableObject<SportradarProductBudget>(
        "SPORTRADAR_PRODUCT_BUDGET",
        { className: "SportradarProductBudget" }
      ),
    SPORTRADAR_QPS: Config.string("SPORTRADAR_QPS").pipe(
      Config.withDefault("1")
    ),
    SPORTRADAR_ROLLING_QUOTA: Config.string("SPORTRADAR_ROLLING_QUOTA").pipe(
      Config.withDefault("1000")
    ),
    SPORTRADAR_ROLLING_WINDOW_DAYS: Config.string(
      "SPORTRADAR_ROLLING_WINDOW_DAYS"
    ).pipe(Config.withDefault("30")),
    SPORTS_QUEUE: sportsQueue,
    UPLOAD_RATE_LIMIT: Cloudflare.RateLimit("upload-rate-limit", {
      namespaceId: rateLimitNamespaceOffset + 1002,
      simple: { limit: 20, period: 60 },
    }),
    WEB_PUSH_VAPID_PRIVATE_KEY: Config.redacted(
      "WEB_PUSH_VAPID_PRIVATE_KEY"
    ).pipe(Config.withDefault(Redacted.make(""))),
    WEB_PUSH_VAPID_PUBLIC_KEY: Config.string("WEB_PUSH_VAPID_PUBLIC_KEY").pipe(
      Config.withDefault("")
    ),
    WEB_PUSH_VAPID_SUBJECT: Config.string("WEB_PUSH_VAPID_SUBJECT").pipe(
      Config.withDefault("mailto:support@myparlaypal.com")
    ),
    WEBHOOK_RATE_LIMIT: Cloudflare.RateLimit("webhook-rate-limit", {
      namespaceId: rateLimitNamespaceOffset + 1004,
      simple: { limit: 300, period: 60 },
    }),
    STRIPE_CREATOR_ANNUAL_PRICE_ID: Config.string(
      "STRIPE_PRICE_CREATOR_YEARLY"
    ),
    STRIPE_CREATOR_PRICE_ID: Config.string("STRIPE_CREATOR_PRICE_ID"),
    STRIPE_PRO_PRICE_ID: Config.string("STRIPE_PRO_PRICE_ID"),
    STRIPE_PRO_ANNUAL_PRICE_ID: Config.string("STRIPE_PRICE_PRO_YEARLY"),
    STRIPE_TAX_ENABLED: Config.string("STRIPE_TAX_ENABLED").pipe(
      Config.withDefault("false")
    ),
    STRIPE_SECRET_KEY: Config.redacted("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: Config.redacted("STRIPE_WEBHOOK_SECRET"),
  },
  main: "../../apps/server/src/index.ts",
  name: `ppal-server${deploymentSuffix}`,
  observability: {
    enabled: true,
    logs: { enabled: true, invocationLogs: true },
    traces: { enabled: true, headSamplingRate: 0.05 },
  },
  workersDev: false,
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

export default Alchemy.Stack(
  "ppal",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const serverWorker = yield* server;
    const extraction = yield* extractionQueue;
    const extractionDeadLetter = yield* extractionDeadLetterQueue;
    const sports = yield* sportsQueue;
    const sportsDeadLetter = yield* sportsDeadLetterQueue;
    const notifications = yield* notificationQueue;
    const notificationsDeadLetter = yield* notificationDeadLetterQueue;

    yield* Cloudflare.Queues.Consumer("extraction-consumer", {
      deadLetterQueue: extractionDeadLetter.queueName,
      queueId: extraction.queueId,
      scriptName: serverWorker.workerName,
      settings: {
        batchSize: 5,
        maxConcurrency: 20,
        maxRetries: 5,
        maxWaitTimeMs: 1000,
        retryDelay: 10,
      },
    });
    yield* Cloudflare.Queues.Consumer("sports-consumer", {
      deadLetterQueue: sportsDeadLetter.queueName,
      queueId: sports.queueId,
      scriptName: serverWorker.workerName,
      settings: {
        batchSize: 10,
        maxConcurrency: 25,
        maxRetries: 5,
        maxWaitTimeMs: 1000,
        retryDelay: 5,
      },
    });
    yield* Cloudflare.Queues.Consumer("notification-consumer", {
      deadLetterQueue: notificationsDeadLetter.queueName,
      queueId: notifications.queueId,
      scriptName: serverWorker.workerName,
      settings: {
        batchSize: 25,
        maxConcurrency: 20,
        maxRetries: 5,
        maxWaitTimeMs: 1000,
        retryDelay: 10,
      },
    });

    const webWorker = yield* Cloudflare.Website.Vite("web", {
      compatibility: {
        date: "2026-09-10",
        flags: ["nodejs_compat"],
      },
      dev: {
        port: 3001,
      },
      // Existing DNS records are managed outside Alchemy; route the proxied
      // hostname to this Worker without taking ownership of those records.
      routes: [{ pattern: `${webDomain}/*` }],
      env: {
        VITE_SERVER_URL: Config.string("VITE_SERVER_URL").pipe(
          Config.withDefault(publicServerUrl)
        ),
      },
      rootDir: "../../apps/web",
      name: `ppal-web${deploymentSuffix}`,
      workersDev: false,
    });

    return {
      server: serverWorker.url,
      web: webWorker.url,
    };
  })
);
