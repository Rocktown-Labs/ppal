import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { createdAtColumn, updatedAtColumn } from "./columns";

export const sports = sqliteTable("sports", {
  createdAt: createdAtColumn(),
  icon: text("icon"),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  updatedAt: updatedAtColumn(),
});

export const leagues = sqliteTable(
  "leagues",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    providerKey: text("provider_key"),
    slug: text("slug").notNull().unique(),
    sportId: text("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("leagues_sport_id_idx").on(table.sportId),
    uniqueIndex("leagues_provider_key_uidx").on(
      table.provider,
      table.providerKey
    ),
  ]
);

export const participants = sqliteTable(
  "participants",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    leagueId: text("league_id").references(() => leagues.id, {
      onDelete: "set null",
    }),
    metadata: text("metadata", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    providerParticipantId: text("provider_participant_id"),
    shortName: text("short_name"),
    sportId: text("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    check("participants_type_check", sql`${table.type} in ('player', 'team')`),
    index("participants_league_id_idx").on(table.leagueId),
    index("participants_name_idx").on(table.name),
    index("participants_sport_id_idx").on(table.sportId),
    uniqueIndex("participants_provider_id_uidx").on(
      table.provider,
      table.providerParticipantId
    ),
  ]
);

export const markets = sqliteTable(
  "markets",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    metadata: text("metadata", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    sportId: text("sport_id").references(() => sports.id, {
      onDelete: "set null",
    }),
    subjectType: text("subject_type").notNull(),
    updatedAt: updatedAtColumn(),
    valueType: text("value_type").notNull(),
  },
  (table) => [
    check(
      "markets_subject_type_check",
      sql`${table.subjectType} in ('player', 'team', 'game')`
    ),
    check(
      "markets_value_type_check",
      sql`${table.valueType} in ('numeric', 'binary', 'moneyline', 'spread')`
    ),
    index("markets_sport_id_idx").on(table.sportId),
  ]
);

export const sportsEvents = sqliteTable(
  "sports_events",
  {
    awayParticipantId: text("away_participant_id").references(
      () => participants.id,
      {
        onDelete: "set null",
      }
    ),
    awayScore: real("away_score"),
    createdAt: createdAtColumn(),
    homeParticipantId: text("home_participant_id").references(
      () => participants.id,
      {
        onDelete: "set null",
      }
    ),
    homeScore: real("home_score"),
    id: text("id").primaryKey(),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    nextPollAt: integer("next_poll_at", { mode: "timestamp_ms" }),
    pollLeaseUntil: integer("poll_lease_until", { mode: "timestamp_ms" }),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    providerPayload: text("provider_payload", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("scheduled"),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    check(
      "sports_events_status_check",
      sql`${table.status} in ('scheduled', 'live', 'final', 'postponed', 'cancelled')`
    ),
    index("sports_events_due_poll_idx").on(
      table.status,
      table.nextPollAt,
      table.pollLeaseUntil
    ),
    index("sports_events_league_starts_at_idx").on(
      table.leagueId,
      table.startsAt
    ),
    uniqueIndex("sports_events_provider_id_uidx").on(
      table.provider,
      table.providerEventId
    ),
  ]
);
