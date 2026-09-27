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

# Sent.dm SMS Setup

SMS delivery is integrated via Sent.dm for Pro/Creator subscribers who opt in and store a phone number.

## Required credentials

- `SENT_DM_API_KEY` — your Sent.dm workspace API key.
- `SENT_DM_TEMPLATE_NAME` (optional) — name of an approved Sent.dm template for the first outgoing message to a new contact.

## Where to set it

Add to `packages/infra/.env` and as a GitHub Actions secret named `SENT_DM_API_KEY`:

```bash
SENT_DM_API_KEY=<your-sent-api-key>
SENT_DM_TEMPLATE_NAME=<template-name>
```

## Before first production send

1. Apply the latest D1 migration so `user.phone_number` and `notification_preferences.sms_enabled` exist.
2. Confirm `SENT_DM_API_KEY` is configured as a Cloudflare Worker secret.
3. Sent.dm normally requires an approved template to start a conversation with a new contact; configure `SENT_DM_TEMPLATE_NAME` if your first message must use one.

## Local development

Copy the key into `apps/server/.dev.vars`:

```text
SENT_DM_API_KEY=<your-sent-api-key>
```

If it is absent, the SMS route will throw and the delivery will be marked failed; other channels continue to work.
