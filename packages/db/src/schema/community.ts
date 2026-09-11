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

export const profiles = sqliteTable(
  "profiles",
  {
    avatarObjectKey: text("avatar_object_key"),
    bio: text("bio"),
    createdAt: createdAtColumn(),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    updatedAt: updatedAtColumn(),
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    username: text("username").notNull().unique(),
  },
  (table) => [
    index("profiles_public_username_idx").on(table.isPublic, table.username),
  ]
);

export const follows = sqliteTable(
  "follows",
  {
    createdAt: createdAtColumn(),
    followedUserId: text("followed_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followerUserId: text("follower_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
  },
  (table) => [
    check(
      "follows_not_self_check",
      sql`${table.followerUserId} != ${table.followedUserId}`
    ),
    uniqueIndex("follows_pair_uidx").on(
      table.followerUserId,
      table.followedUserId
    ),
    index("follows_followed_idx").on(table.followedUserId, table.createdAt),
  ]
);

export const referrals = sqliteTable(
  "referrals",
  {
    claimedAt: integer("claimed_at", { mode: "timestamp_ms" }),
    code: text("code").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    referredUserId: text("referred_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    referrerUserId: text("referrer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestKey: text("request_key"),
    status: text("status").notNull().default("pending"),
  },
  (table) => [
    check(
      "referrals_status_check",
      sql`${table.status} in ('pending', 'completed', 'expired', 'cancelled')`
    ),
    index("referrals_referrer_created_idx").on(
      table.referrerUserId,
      table.createdAt
    ),
    uniqueIndex("referrals_referred_user_uidx").on(table.referredUserId),
    uniqueIndex("referrals_referrer_request_uidx").on(
      table.referrerUserId,
      table.requestKey
    ),
  ]
);
