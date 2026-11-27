import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  doublePrecision,
  index,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";

import { markets, participants, sportsEvents } from "./catalog";
import { createdAtColumn, updatedAtColumn } from "./columns";
import { ticketLegs } from "./tickets";

export const trackingSubscriptions = pgTable(
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

export const statObservations = pgTable(
  "stat_observations",
  {
    createdAt: createdAtColumn(),
    id: serial("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    marketId: text("market_id")
      .notNull()
      .references(() => markets.id, { onDelete: "cascade" }),
    metadata: text("metadata"),
    observedAt: bigint("observed_at", { mode: "number" }).notNull(),
    participantId: text("participant_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull(),
    providerSequence: text("provider_sequence").notNull(),
    sportsEventId: text("sports_event_id")
      .notNull()
      .references(() => sportsEvents.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
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
