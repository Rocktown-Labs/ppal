import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { createdAtColumn, updatedAtColumn } from "./columns";

export const billingEntitlements = sqliteTable(
  "billing_entitlements",
  {
    createdAt: createdAtColumn(),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
    currentPeriodStart: integer("current_period_start", {
      mode: "timestamp_ms",
    }),
    effectiveAt: integer("effective_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
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

export const usageEvents = sqliteTable(
  "usage_events",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    metadata: text("metadata", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    periodEnd: integer("period_end", { mode: "timestamp_ms" }).notNull(),
    periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
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

export const webhookReceipts = sqliteTable(
  "webhook_receipts",
  {
    createdAt: createdAtColumn(),
    errorMessage: text("error_message"),
    id: text("id").primaryKey(),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
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
