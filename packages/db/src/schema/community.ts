import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { createdAtColumn, epochMsNowSql, updatedAtColumn } from "./columns";

export const profiles = pgTable(
  "profiles",
  {
    avatarObjectKey: text("avatar_object_key"),
    bio: text("bio"),
    createdAt: createdAtColumn(),
    isPublic: integer("is_public").notNull().default(1),
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

export const follows = pgTable(
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

export const referrals = pgTable(
  "referrals",
  {
    claimedAt: bigint("claimed_at", { mode: "number" }),
    code: text("code").notNull(),
    completedAt: bigint("completed_at", { mode: "number" }),
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

export const communities = pgTable(
  "communities",
  {
    access: text("access").notNull().default("free"),
    archivedAt: bigint("archived_at", { mode: "number" }),
    createdAt: createdAtColumn(),
    description: text("description"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents"),
    rules: text("rules"),
    slug: text("slug").notNull().unique(),
    updatedAt: updatedAtColumn(),
    visibility: text("visibility").notNull().default("public"),
  },
  (table) => [
    check("communities_access_check", sql`${table.access} in ('free', 'paid')`),
    check(
      "communities_visibility_check",
      sql`${table.visibility} in ('public', 'private')`
    ),
    check(
      "communities_price_check",
      sql`${table.priceCents} is null or (${table.priceCents} >= 100 and ${table.priceCents} <= 100000)`
    ),
    index("communities_owner_idx").on(table.ownerUserId, table.createdAt),
    index("communities_visibility_idx").on(table.visibility, table.createdAt),
  ]
);

export const communityMembers = pgTable(
  "community_members",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    joinedAt: bigint("joined_at", { mode: "number" })
      .default(epochMsNowSql)
      .notNull(),
    paidAt: bigint("paid_at", { mode: "number" }),
    paymentReference: text("payment_reference"),
    role: text("role").notNull().default("member"),
    status: text("status").notNull().default("active"),
    updatedAt: updatedAtColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "community_members_role_check",
      sql`${table.role} in ('owner', 'moderator', 'member')`
    ),
    check(
      "community_members_status_check",
      sql`${table.status} in ('active', 'pending', 'muted', 'banned')`
    ),
    index("community_members_community_idx").on(
      table.communityId,
      table.status,
      table.joinedAt
    ),
    index("community_members_user_idx").on(table.userId, table.joinedAt),
    uniqueIndex("community_members_pair_uidx").on(
      table.communityId,
      table.userId
    ),
  ]
);

export const communityChannels = pgTable(
  "community_channels",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    createdAt: createdAtColumn(),
    description: text("description"),
    id: text("id").primaryKey(),
    isArchived: integer("is_archived").notNull().default(0),
    isDefault: integer("is_default").notNull().default(0),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    slug: text("slug").notNull(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("community_channels_position_idx").on(
      table.communityId,
      table.position
    ),
    uniqueIndex("community_channels_slug_uidx").on(
      table.communityId,
      table.slug
    ),
  ]
);

export const communityMessages = pgTable(
  "community_messages",
  {
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    channelId: text("channel_id")
      .notNull()
      .references(() => communityChannels.id, { onDelete: "cascade" }),
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    createdAt: createdAtColumn(),
    deletedAt: bigint("deleted_at", { mode: "number" }),
    editedAt: bigint("edited_at", { mode: "number" }),
    id: text("id").primaryKey(),
    mentions: text("mentions").notNull().default("[]"),
    replyToId: text("reply_to_id"),
  },
  (table) => [
    index("community_messages_channel_idx").on(
      table.channelId,
      table.createdAt,
      table.id
    ),
    index("community_messages_community_idx").on(
      table.communityId,
      table.createdAt
    ),
  ]
);

export const communityMessageReactions = pgTable(
  "community_message_reactions",
  {
    createdAt: createdAtColumn(),
    emoji: text("emoji").notNull(),
    messageId: text("message_id")
      .notNull()
      .references(() => communityMessages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.userId, table.emoji] }),
    check(
      "community_message_reactions_emoji_length_check",
      sql`length(${table.emoji}) between 1 and 16`
    ),
    index("community_message_reactions_message_idx").on(
      table.messageId,
      table.emoji
    ),
  ]
);

export const communityReports = pgTable(
  "community_reports",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => communityMessages.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    reporterUserId: text("reporter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resolvedAt: bigint("resolved_at", { mode: "number" }),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("open"),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    check(
      "community_reports_status_check",
      sql`${table.status} in ('open', 'resolved', 'dismissed')`
    ),
    index("community_reports_community_idx").on(
      table.communityId,
      table.status,
      table.createdAt
    ),
    uniqueIndex("community_reports_reporter_message_uidx").on(
      table.reporterUserId,
      table.messageId
    ),
  ]
);
