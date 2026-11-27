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

import { user } from "./auth";
import { createdAtColumn, updatedAtColumn } from "./columns";

export const uploads = pgTable(
  "uploads",
  {
    aiModel: text("ai_model"),
    aiResponseVersion: text("ai_response_version"),
    createdAt: createdAtColumn(),
    deletedAt: bigint("deleted_at", { mode: "number" }),
    fileSize: integer("file_size"),
    historicalImportBatchId: text("historical_import_batch_id"),
    id: text("id").primaryKey(),
    ingestionMode: text("ingestion_mode").notNull().default("live"),
    mimeType: text("mime_type"),
    objectKey: text("object_key").notNull().unique(),
    originalFilename: text("original_filename"),
    readyAt: bigint("ready_at", { mode: "number" }),
    retentionExpiresAt: bigint("retention_expires_at", { mode: "number" }),
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

export const extractions = pgTable(
  "extractions",
  {
    createdAt: createdAtColumn(),
    errorMessage: text("error_message"),
    id: text("id").primaryKey(),
    model: text("model"),
    normalizedResponse: text("normalized_response"),
    provider: text("provider").notNull(),
    rawResponse: text("raw_response"),
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

export const historicalImportBatches = pgTable(
  "historical_import_batches",
  {
    completedAt: bigint("completed_at", { mode: "number" }),
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
