import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    ipCountry: text("ip_country"),
    metadata: text("metadata", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    outcome: text("outcome").notNull(),
    requestId: text("request_id"),
    targetId: text("target_id"),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    index("audit_logs_actor_occurred_idx").on(
      table.actorUserId,
      table.occurredAt
    ),
    index("audit_logs_target_occurred_idx").on(
      table.targetType,
      table.targetId,
      table.occurredAt
    ),
  ]
);
