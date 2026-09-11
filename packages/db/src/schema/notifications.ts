import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { createdAtColumn, updatedAtColumn } from "./columns";
import { tickets } from "./tickets";

export const notificationPreferences = sqliteTable("notification_preferences", {
  emailEnabled: integer("email_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  inAppEnabled: integer("in_app_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  legLost: integer("leg_lost", { mode: "boolean" }).notNull().default(true),
  legWon: integer("leg_won", { mode: "boolean" }).notNull().default(true),
  pushEnabled: integer("push_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  ticketLost: integer("ticket_lost", { mode: "boolean" })
    .notNull()
    .default(true),
  ticketWon: integer("ticket_won", { mode: "boolean" }).notNull().default(true),
  updatedAt: updatedAtColumn(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const deviceTokens = sqliteTable(
  "device_tokens",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    platform: text("platform").notNull(),
    token: text("token").notNull().unique(),
    updatedAt: updatedAtColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "device_tokens_platform_check",
      sql`${table.platform} in ('ios', 'android')`
    ),
    index("device_tokens_user_idx").on(table.userId),
  ]
);

export const notifications = sqliteTable(
  "notifications",
  {
    body: text("body").notNull(),
    createdAt: createdAtColumn(),
    data: text("data", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    id: text("id").primaryKey(),
    inAppVisible: integer("in_app_visible", { mode: "boolean" })
      .notNull()
      .default(true),
    milestoneKey: text("milestone_key").notNull().unique(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    ticketId: text("ticket_id").references(() => tickets.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("notifications_user_read_created_idx").on(
      table.userId,
      table.readAt,
      table.createdAt
    ),
  ]
);

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    attempts: integer("attempts").notNull().default(0),
    channel: text("channel").notNull(),
    createdAt: createdAtColumn(),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    deliveryKey: text("delivery_key").notNull().unique(),
    destination: text("destination").notNull(),
    errorMessage: text("error_message"),
    id: text("id").primaryKey(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    providerReceiptId: text("provider_receipt_id"),
    status: text("status").notNull().default("pending"),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    check(
      "notification_deliveries_channel_check",
      sql`${table.channel} in ('push', 'email')`
    ),
    check(
      "notification_deliveries_status_check",
      sql`${table.status} in ('pending', 'processing', 'delivered', 'failed')`
    ),
    index("notification_deliveries_status_idx").on(
      table.status,
      table.updatedAt
    ),
  ]
);

export const notificationStreamLeases = sqliteTable(
  "notification_stream_leases",
  {
    connectionId: text("connection_id").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("notification_stream_leases_expires_idx").on(table.expiresAt),
  ]
);
