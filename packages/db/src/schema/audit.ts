import { bigint, index, pgTable, text } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const auditLogs = pgTable(
  "audit_logs",
  {
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    id: text("id").primaryKey(),
    ipCountry: text("ip_country"),
    metadata: text("metadata"),
    occurredAt: bigint("occurred_at", { mode: "number" }).notNull(),
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
