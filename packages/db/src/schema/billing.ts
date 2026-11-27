import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { createdAtColumn, updatedAtColumn } from "./columns";

export const billingEntitlements = pgTable(
  "billing_entitlements",
  {
    createdAt: createdAtColumn(),
    currentPeriodEnd: bigint("current_period_end", { mode: "number" }),
    currentPeriodStart: bigint("current_period_start", { mode: "number" }),
    effectiveAt: bigint("effective_at", { mode: "number" }).notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }),
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    providerReference: text("provider_reference").notNull(),
    source: text("source").notNull(),
    status: text("status").notNull(),
    updatedAt: updatedAtColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "billing_entitlements_plan_check",
      sql`${table.plan} in ('pro', 'creator')`
    ),
    check(
      "billing_entitlements_source_check",
      sql`${table.source} in ('stripe', 'revenuecat', 'manual')`
    ),
    check(
      "billing_entitlements_status_check",
      sql`${table.status} in ('trialing', 'active', 'grace_period', 'past_due', 'paused', 'cancelled', 'expired')`
    ),
    index("billing_entitlements_user_status_idx").on(
      table.userId,
      table.status,
      table.expiresAt
    ),
    uniqueIndex("billing_entitlements_source_reference_uidx").on(
      table.source,
      table.providerReference
    ),
  ]
);

export const usageEvents = pgTable(
  "usage_events",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    metadata: text("metadata"),
    occurredAt: bigint("occurred_at", { mode: "number" }).notNull(),
    periodEnd: bigint("period_end", { mode: "number" }).notNull(),
    periodStart: bigint("period_start", { mode: "number" }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    resourceId: text("resource_id"),
    resourceType: text("resource_type"),
    status: text("status").notNull().default("reserved"),
    type: text("type").notNull(),
    updatedAt: updatedAtColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    check("usage_events_quantity_check", sql`${table.quantity} > 0`),
    check(
      "usage_events_status_check",
      sql`${table.status} in ('reserved', 'finalized', 'released')`
    ),
    index("usage_events_user_period_idx").on(
      table.userId,
      table.type,
      table.status,
      table.periodStart,
      table.periodEnd
    ),
  ]
);

export const webhookReceipts = pgTable(
  "webhook_receipts",
  {
    createdAt: createdAtColumn(),
    errorMessage: text("error_message"),
    id: text("id").primaryKey(),
    processedAt: bigint("processed_at", { mode: "number" }),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    status: text("status").notNull().default("processing"),
    type: text("type").notNull(),
  },
  (table) => [
    check(
      "webhook_receipts_status_check",
      sql`${table.status} in ('processing', 'processed', 'failed')`
    ),
    uniqueIndex("webhook_receipts_provider_event_uidx").on(
      table.provider,
      table.providerEventId
    ),
  ]
);
