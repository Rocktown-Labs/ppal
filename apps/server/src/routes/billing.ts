import type { Auth } from "@ppal/auth";
import { env } from "@ppal/env/server";
import { Hono } from "hono";
import { z } from "zod";

import { getAuthUser } from "../lib/auth";

const revenueCatEventSchema = z.object({
  aliases: z.array(z.string()).default([]),
  app_user_id: z.string(),
  entitlement_ids: z.array(z.string()).nullable().default([]),
  event_timestamp_ms: z.number().int(),
  expiration_at_ms: z.number().int().nullable().default(null),
  grace_period_expiration_at_ms: z.number().int().nullable().optional(),
  id: z.string(),
  original_app_user_id: z.string(),
  original_transaction_id: z.string().nullable().optional(),
  period_type: z.string().nullable().optional(),
  product_id: z.string().nullable().optional(),
  purchased_at_ms: z.number().int().nullable().optional(),
  transaction_id: z.string().nullable().optional(),
  type: z.string(),
});

const revenueCatPayloadSchema = z.object({
  api_version: z.string(),
  event: revenueCatEventSchema,
});

const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    // Constant-time comparison intentionally requires bitwise accumulation.
    // oxlint-disable-next-line no-bitwise
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
};

const verifyRevenueCatWebhook = async (
  request: Request,
  rawBody: string
): Promise<boolean> => {
  const authorization = request.headers.get("authorization");
  if (
    authorization &&
    constantTimeEqual(authorization, env.REVENUECAT_WEBHOOK_SECRET)
  ) {
    return true;
  }
  const signature = request.headers.get("x-revenuecat-webhook-signature");
  if (!signature) {
    return false;
  }
  const parts = Object.fromEntries(
    signature.split(",").map((part) => part.trim().split("=", 2))
  );
  const timestamp = parts.t;
  const suppliedSignature = parts.v1;
  if (!(timestamp && suppliedSignature)) {
    return false;
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.REVENUECAT_WEBHOOK_SECRET),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`)
  );
  const expected = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return constantTimeEqual(expected, suppliedSignature.toLowerCase());
};

const resolveRevenueCatStatus = (
  event: z.infer<typeof revenueCatEventSchema>
): "active" | "cancelled" | "expired" | "grace_period" | "paused" => {
  if (event.type === "BILLING_ISSUE" && event.grace_period_expiration_at_ms) {
    return "grace_period";
  }
  if (event.type === "SUBSCRIPTION_PAUSED") {
    return "paused";
  }
  if (["EXPIRATION", "REFUND"].includes(event.type)) {
    return "expired";
  }
  if (event.type === "CANCELLATION") {
    return event.expiration_at_ms && event.expiration_at_ms > Date.now()
      ? "active"
      : "expired";
  }
  return "active";
};

const processRevenueCatEvent = async (
  event: z.infer<typeof revenueCatEventSchema>
): Promise<void> => {
  const candidateIds = [
    ...new Set([
      event.app_user_id,
      event.original_app_user_id,
      ...event.aliases,
    ]),
  ];
  const placeholders = candidateIds.map(() => "?").join(", ");
  const matchedUser = await env.DB.prepare(
    `SELECT id FROM user WHERE id IN (${placeholders}) LIMIT 1`
  )
    .bind(...candidateIds)
    .first<{ id: string }>();
  if (!matchedUser) {
    throw new Error("RevenueCat event does not map to a Better Auth user");
  }
  const entitlementIds = event.entitlement_ids ?? [];
  const plan = entitlementIds.includes("creator") ? "creator" : "pro";
  const providerReference =
    event.original_transaction_id ?? event.transaction_id ?? event.id;
  const status = resolveRevenueCatStatus(event);
  const now = Date.now();
  const expiresAt =
    event.grace_period_expiration_at_ms ?? event.expiration_at_ms ?? null;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO billing_entitlements (
        created_at, current_period_end, current_period_start, effective_at,
        expires_at, id, plan, provider_reference, source, status, updated_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'revenuecat', ?, ?, ?)
      ON CONFLICT(source, provider_reference) DO UPDATE SET
        current_period_end = excluded.current_period_end,
        current_period_start = excluded.current_period_start,
        expires_at = excluded.expires_at,
        plan = excluded.plan,
        status = excluded.status,
        updated_at = excluded.updated_at,
        user_id = excluded.user_id`
    ).bind(
      now,
      event.expiration_at_ms,
      event.purchased_at_ms ?? event.event_timestamp_ms,
      event.purchased_at_ms ?? event.event_timestamp_ms,
      expiresAt,
      `revenuecat:${providerReference}`,
      plan,
      providerReference,
      status,
      now,
      matchedUser.id
    ),
    env.DB.prepare(
      "UPDATE webhook_receipts SET status = 'processed', processed_at = ? WHERE provider = 'revenuecat' AND provider_event_id = ?"
    ).bind(now, event.id),
  ]);
};

export const createBillingRoutes = (auth: Auth) =>
  new Hono()
    .get("/billing/entitlements", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const entitlement = await env.DB.prepare(
        `SELECT plan, source, status, current_period_end
         FROM billing_entitlements
         WHERE user_id = ? AND status IN ('trialing', 'active', 'grace_period')
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY CASE plan WHEN 'creator' THEN 2 ELSE 1 END DESC,
           effective_at DESC LIMIT 1`
      )
        .bind(user.id, Date.now())
        .first<{
          current_period_end: number | null;
          plan: "creator" | "pro";
          source: string;
          status: string;
        }>();
      return c.json({
        entitlement: entitlement
          ? {
              currentPeriodEnd: entitlement.current_period_end
                ? new Date(entitlement.current_period_end).toISOString()
                : null,
              plan: entitlement.plan,
              source: entitlement.source,
              status: entitlement.status,
            }
          : {
              currentPeriodEnd: null,
              plan: "free",
              source: null,
              status: "active",
            },
      });
    })
    .post("/webhooks/revenuecat", async (c) => {
      const rawBody = await c.req.text();
      if (!(await verifyRevenueCatWebhook(c.req.raw, rawBody))) {
        return c.json(
          { code: "INVALID_SIGNATURE", error: "Invalid webhook signature" },
          401
        );
      }
      let decoded: unknown;
      try {
        decoded = JSON.parse(rawBody);
      } catch {
        return c.json(
          { code: "INVALID_JSON", error: "Invalid JSON payload" },
          400
        );
      }
      const payload = revenueCatPayloadSchema.safeParse(decoded);
      if (!payload.success) {
        return c.json(
          { code: "INVALID_PAYLOAD", error: "Invalid webhook payload" },
          400
        );
      }
      const receipt = await env.DB.prepare(
        `INSERT INTO webhook_receipts (
          id, provider, provider_event_id, status, type
        ) VALUES (?, 'revenuecat', ?, 'processing', ?)
        ON CONFLICT(provider, provider_event_id) DO UPDATE SET
          created_at = excluded.created_at, error_message = NULL,
          status = 'processing', type = excluded.type
        WHERE webhook_receipts.status = 'failed'
          OR (webhook_receipts.status = 'processing' AND webhook_receipts.created_at < ?)`
      )
        .bind(
          crypto.randomUUID(),
          payload.data.event.id,
          payload.data.event.type,
          Date.now() - 5 * 60 * 1000
        )
        .run();
      if (receipt.meta.changes === 0) {
        return c.json({ received: true });
      }
      try {
        await processRevenueCatEvent(payload.data.event);
      } catch (error) {
        await env.DB.prepare(
          "UPDATE webhook_receipts SET status = 'failed', error_message = ? WHERE provider = 'revenuecat' AND provider_event_id = ?"
        )
          .bind(
            error instanceof Error
              ? error.message.slice(0, 1000)
              : "Unknown error",
            payload.data.event.id
          )
          .run();
        throw error;
      }
      return c.json({ received: true });
    });
