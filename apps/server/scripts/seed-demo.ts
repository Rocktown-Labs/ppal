/**
 * Seeds the local demo dataset (demo account, tickets, notifications,
 * communities, threads, roster) into the local D1 database.
 *
 * Prerequisites: migrations applied locally + the dev server running.
 *
 *   bun run db:migrate:local
 *   bun run dev:server
 *   bun run db:seed-demo
 *
 * Idempotent — safe to run repeatedly. Never works against production; the
 * endpoint refuses on the production origin.
 */

const DEFAULT_API_URL = "http://127.0.0.1:3000";
const DEV_VARS_PATH = new URL("../.dev.vars", import.meta.url);

const readOperationsToken = async (): Promise<string> => {
  const file = Bun.file(DEV_VARS_PATH);
  const raw = await file.text().catch(() => null);
  if (raw === null) {
    throw new Error(
      "No .dev.vars found — copy .dev.vars.example and configure OPERATIONS_API_TOKEN."
    );
  }
  for (const line of raw.split("\n")) {
    const match = /^OPERATIONS_API_TOKEN=(?<token>.*)$/u.exec(line.trim());
    if (match?.groups?.token) {
      return match.groups.token.trim().replaceAll(/^"|"$/gu, "");
    }
  }
  throw new Error("OPERATIONS_API_TOKEN is not set in .dev.vars.");
};

const main = async (): Promise<void> => {
  const baseUrl = process.env.PPAL_SEED_URL ?? DEFAULT_API_URL;
  const token = await readOperationsToken();
  const endpoint = `${baseUrl}/api/v1/operations/demo-seed`;

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  }).catch(() => null);
  if (!response) {
    throw new Error(
      `Could not reach ${baseUrl}. Start the dev server first: bun run dev:server`
    );
  }

  const body = (await response.json().catch(() => null)) as {
    code?: string;
    communities?: number;
    error?: string;
    messages?: number;
    seeded?: boolean;
    tickets?: number;
    users?: string[];
  } | null;

  if (!response.ok || !body?.seeded) {
    throw new Error(
      body?.error ?? `Seed failed with status ${response.status}`
    );
  }

  console.log(
    `Seeded demo data: ${body.tickets} tickets, ${body.communities} communities, ${body.messages} messages.`
  );
  if (body.users && body.users.length > 0) {
    console.log(`Created users: ${body.users.join(", ")}`);
  }
  console.log("Sign in with: bettor@parlaypal.com / parlaypal-demo");
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exit(1);
}
