# Production Secrets Setup

This app uses `DATA_ENCRYPTION_KEY` to encrypt sensitive database columns at rest. This document explains how to set it in production without deleting any existing data.

## Generating the key

Use a random 32-byte value. Do not reuse `BETTER_AUTH_SECRET` or any other secret.

```bash
openssl rand -base64 32
```

The value can be any sufficiently long string; internally it is hashed to a 32-byte AES-256 key with SHA-256, so exact length is not required.

## Where to set it

The key is wired in `alchemy.run.ts` as a redacted Worker configuration value (`DATA_ENCRYPTION_KEY`). It must be present in the environment where you run Alchemy deploys:

```bash
# packages/infra/.env
DATA_ENCRYPTION_KEY=<value>
```

For preview deployments (PRs) or if you prefer to set it outside `.env`, add it to the GitHub Action secret `DATA_ENCRYPTION_KEY` (or your deploy runner's environment).

## Deploying with Alchemy

```bash
cd packages/infra
bun alchemy up
```

Alchemy reads the env var and attaches it to the `server` Worker as a secret. Nothing is deleted.

## Verifying after deploy

Open the Cloudflare dashboard, go to Workers & Pages > ppal-server > Settings

> Variables and Secrets, and confirm `DATA_ENCRYPTION_KEY` is marked as encrypted and has a value.

## If you rotate the key later

Existing encrypted rows are tied to the key that created them. To rotate safely:

1. Keep the old key available.
2. Update `DATA_ENCRYPTION_KEY` to the new value.
3. Run a backfill that reads each encrypted row with the old key and re-encrypts it with the new key.
4. Remove the old key only after every row has been rewritten.

Until a proper backfill is run, rows written before the rotation will be undecryptable.

## Local development

Copy the key into `apps/server/.dev.vars`:

```text
DATA_ENCRYPTION_KEY=<value>
```

If you do not set it locally, the app runs in plaintext fallback mode so tests and local hacking keep working.
