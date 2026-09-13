import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import {
  leagues,
  markets,
  participants,
  sports,
  sportsEvents,
} from "./catalog";
import { createdAtColumn, updatedAtColumn } from "./columns";
import { historicalImportBatches, uploads } from "./ingestion";

export const tickets = sqliteTable(
  "tickets",
  {
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
    displayedResult: text("displayed_result"),
    historicalImportBatchId: text("historical_import_batch_id").references(
      () => historicalImportBatches.id,
      { onDelete: "set null" }
    ),
    id: text("id").primaryKey(),
    ingestionMode: text("ingestion_mode").notNull().default("live"),
    lastProgressNotifiedAt: integer("last_progress_notified_at", {
      mode: "timestamp_ms",
    }),
    notificationIntervalMinutes: integer("notification_interval_minutes")
      .notNull()
      .default(10),
    resultSource: text("result_source"),
    settledAt: integer("settled_at", { mode: "timestamp_ms" }),
    sourceName: text("source_name"),
    sourceUploadId: text("source_upload_id").references(() => uploads.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("needs_review"),
    ticketType: text("ticket_type").notNull().default("parlay"),
    trackingStartedAt: integer("tracking_started_at", { mode: "timestamp_ms" }),
    updatedAt: updatedAtColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verificationStatus: text("verification_status")
      .notNull()
      .default("unverified"),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    check(
      "tickets_ingestion_mode_check",
      sql`${table.ingestionMode} in ('live', 'historical')`
    ),
    check(
      "tickets_notification_interval_check",
      sql`${table.notificationIntervalMinutes} in (5, 10, 15)`
    ),
    check(
      "tickets_result_source_check",
      sql`${table.resultSource} is null or ${table.resultSource} in ('live_provider', 'historical_provider', 'settled_slip', 'manual')`
    ),
    check(
      "tickets_status_check",
      sql`${table.status} in ('draft', 'needs_review', 'scheduled', 'live', 'won', 'lost', 'push', 'void', 'partially_void', 'settled')`
    ),
    check(
      "tickets_ticket_type_check",
      sql`${table.ticketType} in ('parlay', 'single', 'sgp', 'teaser', 'round_robin')`
    ),
    check(
      "tickets_verification_status_check",
      sql`${table.verificationStatus} in ('unverified', 'partially_verified', 'verified')`
    ),
    index("tickets_user_status_created_at_idx").on(
      table.userId,
      table.status,
      table.createdAt
    ),
  ]
);

export const ticketLegs = sqliteTable(
  "ticket_legs",
  {
    createdAt: createdAtColumn(),
    currentValue: real("current_value"),
    displayDescription: text("display_description"),
    eventHint: text("event_hint", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    id: text("id").primaryKey(),
    lastNotifiedSnapshot: text("last_notified_snapshot"),
    leagueId: text("league_id").references(() => leagues.id, {
      onDelete: "set null",
    }),
    lostAt: integer("lost_at", { mode: "timestamp_ms" }),
    marketComponents: text("market_components", { mode: "json" }).$type<
      string[] | null
    >(),
    marketId: text("market_id").references(() => markets.id, {
      onDelete: "set null",
    }),
    operator: text("operator").notNull().default("over"),
    participantId: text("participant_id").references(() => participants.id, {
      onDelete: "set null",
    }),
    rawDescription: text("raw_description").notNull(),
    rawLeagueName: text("raw_league_name"),
    rawMarketName: text("raw_market_name"),
    rawSportName: text("raw_sport_name"),
    resolverConfidence: real("resolver_confidence"),
    resolverStatus: text("resolver_status").notNull().default("ambiguous"),
    secondaryTargetValue: real("secondary_target_value"),
    settledAt: integer("settled_at", { mode: "timestamp_ms" }),
    sportId: text("sport_id").references(() => sports.id, {
      onDelete: "set null",
    }),
    sportsEventId: text("sports_event_id").references(() => sportsEvents.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending"),
    subjectName: text("subject_name").notNull(),
    subjectType: text("subject_type").notNull().default("player"),
    targetValue: real("target_value"),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    updatedAt: updatedAtColumn(),
    version: integer("version").notNull().default(1),
    wonAt: integer("won_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    check(
      "ticket_legs_operator_check",
      sql`${table.operator} in ('over', 'under', 'gte', 'lte', 'equals', 'moneyline', 'spread', 'yes', 'no', 'custom')`
    ),
    check(
      "ticket_legs_resolver_status_check",
      sql`${table.resolverStatus} in ('resolved', 'ambiguous', 'not_found', 'unsupported')`
    ),
    check(
      "ticket_legs_status_check",
      sql`${table.status} in ('pending', 'live', 'won', 'lost', 'push', 'void', 'cancelled', 'unresolved')`
    ),
    check(
      "ticket_legs_subject_type_check",
      sql`${table.subjectType} in ('player', 'team', 'game')`
    ),
    index("ticket_legs_event_status_idx").on(table.sportsEventId, table.status),
    index("ticket_legs_ticket_id_idx").on(table.ticketId),
  ]
);

export const ticketTimelineEvents = sqliteTable(
  "ticket_timeline_events",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    message: text("message"),
    metadata: text("metadata", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    ticketLegId: text("ticket_leg_id").references(() => ticketLegs.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    transitionKey: text("transition_key").notNull().unique(),
    type: text("type").notNull(),
  },
  (table) => [
    index("ticket_timeline_events_ticket_occurred_at_idx").on(
      table.ticketId,
      table.occurredAt
    ),
  ]
);
