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

export const uploads = sqliteTable(
  "uploads",
  {
    aiModel: text("ai_model"),
    aiResponseVersion: text("ai_response_version"),
    createdAt: createdAtColumn(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    fileSize: integer("file_size"),
    historicalImportBatchId: text("historical_import_batch_id"),
    id: text("id").primaryKey(),
    ingestionMode: text("ingestion_mode").notNull().default("live"),
    mimeType: text("mime_type"),
    objectKey: text("object_key").notNull().unique(),
    originalFilename: text("original_filename"),
    readyAt: integer("ready_at", { mode: "timestamp_ms" }),
    retentionExpiresAt: integer("retention_expires_at", {
      mode: "timestamp_ms",
    }),
    sha256: text("sha256"),
    status: text("status").notNull().default("pending"),
    updatedAt: updatedAtColumn(),
    usageReservationKey: text("usage_reservation_key").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "uploads_ingestion_mode_check",
      sql`${table.ingestionMode} in ('live', 'historical')`
    ),
    check(
      "uploads_status_check",
      sql`${table.status} in ('pending', 'uploading', 'ready', 'processing', 'extracted', 'failed')`
    ),
    index("uploads_status_created_at_idx").on(table.status, table.createdAt),
    uniqueIndex("uploads_user_sha256_uidx").on(table.userId, table.sha256),
  ]
);

export const extractions = sqliteTable(
  "extractions",
  {
    createdAt: createdAtColumn(),
    errorMessage: text("error_message"),
    id: text("id").primaryKey(),
    model: text("model"),
    normalizedResponse: text("normalized_response", {
      mode: "json",
    }).$type<Record<string, unknown> | null>(),
    provider: text("provider").notNull(),
    rawResponse: text("raw_response", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    schemaVersion: text("schema_version").notNull(),
    status: text("status").notNull().default("pending"),
    updatedAt: updatedAtColumn(),
    uploadId: text("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "extractions_status_check",
      sql`${table.status} in ('pending', 'completed', 'failed')`
    ),
    index("extractions_upload_created_at_idx").on(
      table.uploadId,
      table.createdAt
    ),
  ]
);

export const historicalImportBatches = sqliteTable(
  "historical_import_batches",
  {
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    needsReviewCount: integer("needs_review_count").notNull().default(0),
    processedFiles: integer("processed_files").notNull().default(0),
    status: text("status").notNull().default("pending"),
    totalFiles: integer("total_files").notNull(),
    updatedAt: updatedAtColumn(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verifiedCount: integer("verified_count").notNull().default(0),
  },
  (table) => [
    check(
      "historical_import_batches_status_check",
      sql`${table.status} in ('pending', 'processing', 'completed', 'failed', 'cancelled')`
    ),
    index("historical_import_batches_user_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  ]
);
