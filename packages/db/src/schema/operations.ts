import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { createdAtColumn, updatedAtColumn } from "./columns";

export const operationFailures = pgTable(
  "operation_failures",
  {
    attempts: integer("attempts").notNull(),
    createdAt: createdAtColumn(),
    errorMessage: text("error_message").notNull(),
    id: text("id").primaryKey(),
    messageId: text("message_id").notNull(),
    payload: text("payload").notNull(),
    queue: text("queue").notNull(),
    replayedAt: bigint("replayed_at", { mode: "number" }),
    status: text("status").notNull().default("failed"),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    check(
      "operation_failures_status_check",
      sql`${table.status} in ('failed', 'replayed', 'resolved')`
    ),
    uniqueIndex("operation_failures_message_uidx").on(
      table.queue,
      table.messageId
    ),
    index("operation_failures_status_created_idx").on(
      table.status,
      table.createdAt
    ),
  ]
);

export const migrationReceipts = pgTable(
  "migration_receipts",
  {
    createdAt: createdAtColumn(),
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    uniqueIndex("migration_receipts_source_uidx").on(
      table.source,
      table.targetType,
      table.sourceId
    ),
  ]
);
