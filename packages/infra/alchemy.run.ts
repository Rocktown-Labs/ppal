/* oxlint-disable func-names, sort-keys -- Resources are ordered by lifecycle and binding role. */

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });
config({ path: "../../apps/server/.env" });

const pullRequestNumber = process.env.PR_NUMBER?.trim();
const isPullRequest = /^\d+$/u.test(pullRequestNumber ?? "");
const deploymentSuffix = isPullRequest ? `-pr-${pullRequestNumber}` : "";
const apiDomain = isPullRequest
  ? `api-pr-${pullRequestNumber}.myparlaypal.com`
  : "api.myparlaypal.com";
const webDomain = isPullRequest
  ? `pr-${pullRequestNumber}.myparlaypal.com`
  : "myparlaypal.com";

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
  domain: apiDomain,
  env: {
    ANALYTICS: analytics,
    API_RATE_LIMIT: Cloudflare.RateLimit("api-rate-limit", {
      namespaceId: 1001,
      simple: { limit: 120, period: 60 },
    }),
    APPLE_CLIENT_ID: Config.string("APPLE_CLIENT_ID").pipe(
      Config.withDefault("")
    ),
    APPLE_CLIENT_SECRET: Config.redacted("APPLE_CLIENT_SECRET").pipe(
      Config.withDefault(Redacted.make(""))
    ),
    BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
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
    R2_UPLOADS: uploads,
    RESEND_API_KEY: Config.redacted("RESEND_API_KEY").pipe(
      Config.withDefault(Redacted.make(""))
    ),
    RESEND_FROM_EMAIL: Config.string("RESEND_FROM_EMAIL").pipe(
      Config.withDefault("support@myparlaypal.com")
    ),
    REVENUECAT_WEBHOOK_SECRET: Config.redacted("REVENUECAT_WEBHOOK_SECRET"),
    SPORTRADAR_API_KEY: Config.redacted("SPORTRADAR_API_KEY"),
    SPORTS_QUEUE: sportsQueue,
    UPLOAD_RATE_LIMIT: Cloudflare.RateLimit("upload-rate-limit", {
      namespaceId: 1002,
      simple: { limit: 20, period: 60 },
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
      domain: webDomain,
      env: {
        VITE_SERVER_URL: serverWorker.url.as<string>(),
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
