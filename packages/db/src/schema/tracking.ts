import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { markets, participants, sportsEvents } from "./catalog";
import { createdAtColumn, updatedAtColumn } from "./columns";
import { ticketLegs } from "./tickets";

export const trackingSubscriptions = sqliteTable(
  "tracking_subscriptions",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    marketId: text("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    participantId: text("participant_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    sportsEventId: text("sports_event_id")
      .notNull()
      .references(() => sportsEvents.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    subscriptionKey: text("subscription_key").notNull().unique(),
    ticketLegId: text("ticket_leg_id")
      .notNull()
      .references(() => ticketLegs.id, { onDelete: "cascade" }),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    check(
      "tracking_subscriptions_status_check",
      sql`${table.status} in ('active', 'paused', 'completed', 'cancelled')`
    ),
    index("tracking_subscriptions_lookup_idx").on(
      table.sportsEventId,
      table.participantId,
      table.marketId,
      table.status
    ),
    index("tracking_subscriptions_leg_event_market_idx").on(
      table.ticketLegId,
      table.sportsEventId,
      table.participantId,
      table.marketId
    ),
  ]
);

export const statObservations = sqliteTable(
  "stat_observations",
  {
    createdAt: createdAtColumn(),
    id: integer("id").primaryKey({ autoIncrement: true }),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    marketId: text("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    metadata: text("metadata", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    observedAt: integer("observed_at", { mode: "timestamp_ms" }).notNull(),
    participantId: text("participant_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    providerSequence: text("provider_sequence").notNull(),
    sportsEventId: text("sports_event_id")
      .notNull()
      .references(() => sportsEvents.id, { onDelete: "cascade" }),
    value: real("value").notNull(),
  },
  (table) => [
    index("stat_observations_lookup_idx").on(
      table.sportsEventId,
      table.participantId,
      table.marketId,
      table.observedAt
    ),
    index("stat_observations_provider_sequence_idx").on(
      table.provider,
      table.sportsEventId,
      table.participantId,
      table.marketId,
      table.providerSequence
    ),
  ]
);
