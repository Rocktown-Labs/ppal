import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { createdAtColumn, updatedAtColumn } from "./columns";
import { tickets } from "./tickets";

export const notificationPreferences = pgTable("notification_preferences", {
  emailEnabled: integer("email_enabled").notNull().default(1),
  inAppEnabled: integer("in_app_enabled").notNull().default(1),
  legLost: integer("leg_lost").notNull().default(1),
  legWon: integer("leg_won").notNull().default(1),
  pushEnabled: integer("push_enabled").notNull().default(1),
  smsEnabled: integer("sms_enabled").notNull().default(0),
  ticketLost: integer("ticket_lost").notNull().default(1),
  ticketWon: integer("ticket_won").notNull().default(1),
  updatedAt: updatedAtColumn(),
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const deviceTokens = pgTable(
  "device_tokens",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    lastSeenAt: bigint("last_seen_at", { mode: "number" }).notNull(),
    platform: text("platform").notNull(),
    token: text("token").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
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

export const notifications = pgTable(
  "notifications",
  {
    body: text("body").notNull(),
    createdAt: createdAtColumn(),
    data: text("data"),
    id: text("id").primaryKey(),
    inAppVisible: integer("in_app_visible").notNull().default(1),
    milestoneKey: text("milestone_key").notNull().unique(),
    readAt: bigint("read_at", { mode: "number" }),
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

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    attempts: integer("attempts").notNull().default(0),
    channel: text("channel").notNull(),
    createdAt: createdAtColumn(),
    deliveredAt: bigint("delivered_at", { mode: "number" }),
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
      sql`${table.channel} in ('push', 'email', 'web_push', 'sms')`
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

export const webPushSubscriptions = pgTable(
  "web_push_subscriptions",
  {
    auth: text("auth").notNull(),
    createdAt: createdAtColumn(),
    endpoint: text("endpoint").primaryKey(),
    lastSeenAt: bigint("last_seen_at", { mode: "number" }).notNull(),
    p256dh: text("p256dh").notNull(),
    updatedAt: updatedAtColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("web_push_subscriptions_user_idx").on(table.userId)]
);

export const notificationStreamLeases = pgTable(
  "notification_stream_leases",
  {
    connectionId: text("connection_id").notNull(),
    expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("notification_stream_leases_expires_idx").on(table.expiresAt),
  ]
);
