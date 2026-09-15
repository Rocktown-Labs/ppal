# ppal

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Start, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Start** - SSR framework with TanStack Router
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **workers** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **Cloudflare D1** - Database engine
- **Authentication** - Better-Auth
- **Billing** - Better Auth Stripe plugin + RevenueCat entitlement webhooks
- **Uploads** - private R2 objects with SHA-256 verification
- **Async processing** - Cloudflare Queues with dead-letter queues
- **Sports tracking** - shared Sportradar event polling and deterministic settlement
- **Turborepo** - Optimized monorepo build system
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **Husky** - Git hooks for code quality

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses Cloudflare D1 (SQLite) with Drizzle ORM for runtime queries.

Runtime database access uses the Cloudflare `DB` binding from `packages/infra/alchemy.run.ts`. If a local `DATABASE_URL` is present, it is only for database tooling.

Alchemy provisions the D1 database and applies the forward-only SQL migrations under `packages/db/src/migrations/<timestamp>_<name>/migration.sql` during `deploy`. Apply the same migrations to a local Wrangler D1 database with:

```bash
bun run db:migrate:local
```

The migration directory intentionally uses Alchemy's recursive Drizzle-v1 layout; do not run `drizzle-kit generate` against it. Add a new forward-only SQL migration directory instead so Alchemy and Wrangler share one source of truth.

Then, run the development server:

```bash
bun run dev
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001) in your browser to see the web application. Keeping both development servers on `127.0.0.1` preserves the Better Auth same-site cookie boundary. Use the Expo Go app to run the mobile application. The local API is running at [http://127.0.0.1:3000](http://127.0.0.1:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@ppal/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Deployment

### Alchemy

- Target: web on Cloudflare + server on Cloudflare
- Configure Cloudflare provider login: `cd packages/infra && bun alchemy profile edit --add Cloudflare`
- Dev: bun run dev
- Deploy: bun run deploy
- Destroy: bun run destroy

`alchemy profile edit --add Cloudflare` stores the OAuth or API-token credential in the active Alchemy profile under `~/.alchemy`; no `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` export is required for local deploys.

Copy `packages/infra/.env.example` to `packages/infra/.env` only for a local Alchemy deployment. Never commit that file. GitHub Actions uses separate `preview` and `production` Environment secrets; production deploys require a manual workflow dispatch and environment approval. Production uses `myparlaypal.com` for the TanStack app and `api.myparlaypal.com` for the Hono Worker. PR environments use `pr-<number>.myparlaypal.com` and `api-pr-<number>.myparlaypal.com`.

The Cloudflare deployment token must be scoped to the target account and the `myparlaypal.com` zone. Grant only the edit/read permissions Alchemy needs for Workers Scripts, D1, R2, Queues, Analytics Engine, and Workers Routes/custom domains. A token copied from an R2 S3 access-key flow is not a Cloudflare API token and will fail authentication.

Browser push is opt-in from Dashboard → Settings. Generate one VAPID key pair and add `WEB_PUSH_VAPID_PRIVATE_KEY` as a secret and `WEB_PUSH_VAPID_PUBLIC_KEY` as an environment variable in both the `preview` and `production` GitHub environments. The optional subject defaults to `mailto:support@myparlaypal.com`. Generate keys locally with:

```bash
bun -e 'import { generateVapidKeys } from "@mmmike/web-push/vapid"; console.log(await generateVapidKeys())'
```

The public key is returned only to an authenticated browser. The private key stays in the Worker binding and is never exposed to the web bundle.

Configure provider webhooks after the first production deployment:

- Stripe: `https://api.myparlaypal.com/api/auth/stripe/webhook`
- RevenueCat: `https://api.myparlaypal.com/api/v1/webhooks/revenuecat`

Use the Better Auth subscription endpoints under `/api/auth/subscription/*` for Checkout and the Stripe billing portal. Configure RevenueCat to use the Better Auth user ID as its App User ID; anonymous RevenueCat IDs are deliberately not trusted for server entitlements.

The web subscription catalog is managed from Dashboard → Admin → Stripe catalog. The Sync Stripe action reuses matching products/prices and creates missing Pro and Creator monthly/yearly prices with stable lookup keys, so price IDs do not need to be hard-coded into the web bundle. The Stripe secret and webhook signing secret still need to be configured in the production Worker environment.

Deploys are staged and default to a personal `dev_<username>` stage. For production, run the deploy with an explicit stage from `packages/infra`:

```bash
cd packages/infra && bun alchemy deploy --stage production
```

### Production origins

Alchemy fixes production CORS to `https://myparlaypal.com` by default and derives the exact PR origin for every preview. Better Auth keeps secure, HTTP-only, `SameSite=Lax` cookies; the API also rejects cross-site unsafe requests using Origin and Fetch Metadata validation.

## Git Hooks and Formatting

- Initialize hooks: `bun run prepare`
- Run checks: `bun run check`

## Project Structure

```
ppal/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Start)
│   ├── native/      # Mobile application (React Native, Expo)
│   └── server/      # Backend API (Hono)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run dev:native`: Start the React Native/Expo development server
- `bun run check`: Run Oxlint and Oxfmt
