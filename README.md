# ParlayPal

<div align="center">
  <h3>Sports tracking, ticket history, and community in one place</h3>
  <p>Follow sporting events, organize tracked tickets, and review how your activity settles over time across web and mobile.</p>
</div>

[myparlaypal.com](https://myparlaypal.com)

---

## 1. Product Overview

**ParlayPal** is a sports tracking and community application with web, API, and Expo mobile workspaces. The platform brings together event data, ticket records, notifications, user billing, and community features. A shared event polling service consumes Sportradar data, while deterministic settlement logic updates tracked outcomes from the same event source.

The repository is designed for a Cloudflare edge deployment: the web application and Hono API use D1 for runtime data, private R2 objects for uploads, and Cloudflare Queues for asynchronous work.

## 2. System Architecture

```text
Web (TanStack Start)         Mobile (Expo / React Native)
             └──────────────────┬──────────────────┘
                                │
                         Hono API Worker
                                │
           ┌────────────────────┼───────────────────┐
           ▼                    ▼                   ▼
      Cloudflare D1        Private R2          Queues + DLQ
       Drizzle ORM       verified uploads    async processing
                                │
                                ▼
                     Sportradar event polling
                       and ticket settlement
```

| Layer | Technologies |
| --- | --- |
| Web | React, TanStack Start, TanStack Router |
| Native | Expo / React Native |
| API | Hono on Cloudflare Workers |
| Database | Cloudflare D1 with Drizzle ORM and forward-only SQL migrations |
| Authentication | Better Auth |
| Billing | Stripe through Better Auth and RevenueCat entitlement webhooks |
| File storage | Private Cloudflare R2 objects with SHA-256 verification |
| Background work | Cloudflare Queues and dead-letter queues |
| Sports data | Sportradar polling and deterministic settlement |
| Workspace | Bun and Turborepo |

## 3. Product Capabilities

### Sports tracking

- Follow event activity through shared sports-data polling.
- Record and review sports tickets in the web and mobile experiences.
- Settle tracked outcomes deterministically from the event data pipeline.
- Use analytics and operational tools to support event ingestion and ongoing service health.

### Community and account experience

- Explore community surfaces and user profiles.
- Use notifications and account features across the web and native app.
- Opt in to browser push notifications from Dashboard → Settings.
- Keep subscriptions and entitlements synchronized through Better Auth, Stripe, and RevenueCat webhook paths.

### Uploads and asynchronous work

- Store uploads as private R2 objects.
- Verify upload integrity with SHA-256 checks.
- Process queued work outside the request path and route failed messages to dead-letter queues.

### Billing

The subscription catalog is managed from the administration area. Stripe product and price synchronization uses stable lookup keys so product pricing does not need to be embedded in the client. RevenueCat webhook processing is associated with the Better Auth user ID; anonymous RevenueCat identifiers are not trusted for server entitlements.

## 4. Monorepo Structure

```text
ppal/
├── apps/
│   ├── web/                 # Web app, dashboard, community, and sports pages
│   ├── server/              # Hono API, event services, and Durable Objects
│   └── native/              # Expo / React Native app
├── packages/
│   ├── api/                 # Shared API contracts
│   ├── auth/                # Better Auth setup
│   ├── contracts/           # Shared domain contracts
│   ├── db/                  # D1 schema, migrations, and upload encryption
│   ├── domain/              # Shared tracking domain logic
│   ├── env/                 # Runtime environment validation
│   ├── infra/               # Alchemy Cloudflare resources
│   └── ui/                  # Shared UI components and styles
└── evals/                   # Extraction evaluation utilities
```

## 5. Local Development

### Prerequisites

- Bun 1.3.10
- Cloudflare / Alchemy credentials when deploying or working against remote services
- Xcode or Android Studio for local native builds

Install the workspace and start web plus API development:

```bash
bun install
bun run dev
```

The web app is served at `http://127.0.0.1:3001` and the local API at `http://127.0.0.1:3000`. Keeping both on `127.0.0.1` preserves the Better Auth same-site cookie boundary. To start native development:

```bash
bun run dev:native
```

Run local D1 migrations and seed demo data with:

```bash
bun run db:migrate:local
bun run demo:seed
```

Migrations are forward-only SQL under `packages/db/src/migrations/<timestamp>_<name>/migration.sql`. Add a new migration directory for schema changes; do not run `drizzle-kit generate` against the Alchemy recursive migration layout.

## 6. Useful Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the web app and API |
| `bun run dev:web` / `bun run dev:server` | Start one web or server workspace |
| `bun run dev:native` | Start the Expo app |
| `bun run build` | Build configured workspaces |
| `bun run check-types` | Type-check workspaces |
| `bun run check` | Run Ultracite checks |
| `bun run test` | Run configured tests |
| `bun run db:migrate:local` | Apply local D1 migrations |
| `bun run demo:seed` | Seed local demo data |
| `bun run deploy` | Deploy the selected Alchemy stage |
| `bun run destroy` | Destroy the selected Alchemy stage |

## 7. Deployment & Configuration

Alchemy provisions the web app and Hono Worker, D1, R2, Queues, Analytics Engine, and related Cloudflare resources. Local Alchemy credentials are stored in the active Alchemy profile; do not place provider tokens in source control.

Production uses `myparlaypal.com` for the web app and `api.myparlaypal.com` for the API. Pull request previews use a per-PR origin. Production deployment is stage-specific and requires the configured production workflow approval.

Optional integrations include:

- **Browser push:** configure a VAPID key pair in the preview and production environments. The private key remains server-side.
- **Stripe:** configure the API secret and webhook signing secret for subscriptions.
- **RevenueCat:** point its webhook at the server and use the Better Auth user ID as the App User ID.

## 8. Security & Quality

The API uses secure, HTTP-only, SameSite cookies and validates cross-site unsafe requests. Uploads remain private and are checked before processing. Keep database, billing, webhook, and provider credentials in environment stores.

Run the repository checks before proposing changes:

```bash
bun run check
bun run check-types
bun run test
bun run build
```

<div align="center">
  <sub>Built to make sports activity easier to follow and review.</sub>
</div>
