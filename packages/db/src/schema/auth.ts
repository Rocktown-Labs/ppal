import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  referralCode: text("referral_code").unique(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" })
    .default(false)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
});

export const subscription = sqliteTable(
  "subscription",
  {
    billingInterval: text("billing_interval"),
    cancelAt: integer("cancel_at", { mode: "timestamp_ms" }),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .default(false)
      .notNull(),
    canceledAt: integer("canceled_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    id: text("id").primaryKey(),
    periodEnd: integer("period_end", { mode: "timestamp_ms" }),
    periodStart: integer("period_start", { mode: "timestamp_ms" }),
    plan: text("plan").notNull(),
    referenceId: text("reference_id").notNull(),
    seats: integer("seats"),
    status: text("status").notNull().default("incomplete"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeScheduleId: text("stripe_schedule_id"),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    trialEnd: integer("trial_end", { mode: "timestamp_ms" }),
    trialStart: integer("trial_start", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("subscription_reference_id_idx").on(table.referenceId),
    index("subscription_status_idx").on(table.status),
  ]
);

export const session = sqliteTable(
  "session",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    accountId: text("account_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    issuer: text("issuer").notNull(),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("account_issuer_accountId_uidx").on(
      table.issuer,
      table.accountId
    ),
    index("account_userId_idx").on(table.userId),
  ]
);

export const verification = sqliteTable(
  "verification",
  {
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const twoFactor = sqliteTable(
  "twoFactor",
  {
    backupCodes: text("backup_codes").notNull(),
    failedVerificationCount: integer("failed_verification_count").default(0),
    id: text("id").primaryKey(),
    lockedUntil: integer("locked_until", { mode: "timestamp_ms" }),
    secret: text("secret").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: integer("verified", { mode: "boolean" }).default(true),
  },
  (table) => [
    index("two_factor_secret_idx").on(table.secret),
    index("two_factor_userId_idx").on(table.userId),
  ]
);

export const passkey = sqliteTable(
  "passkey",
  {
    aaguid: text("aaguid"),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull(),
    counter: integer("counter").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    credentialID: text("credential_id").notNull(),
    deviceType: text("device_type").notNull(),
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    transports: text("transports"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("passkey_credentialID_idx").on(table.credentialID),
    index("passkey_userId_idx").on(table.userId),
  ]
);

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  passkeys: many(passkey),
  sessions: many(session),
  twoFactors: many(twoFactor),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(user, {
    fields: [twoFactor.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));
