/* oxlint-disable no-await-in-loop -- Batch admission is serialized so quota and duplicate checks stay deterministic. */

import { zValidator } from "@hono/zod-validator";
import type { Auth } from "@ppal/auth";
import { createHistoricalImportSchema } from "@ppal/contracts/imports";
import type { HistoricalImportContract } from "@ppal/contracts/imports";
import { env } from "@ppal/env/server";
import { Hono } from "hono";

import { getAuthUser } from "../lib/auth";
import { scopeIdempotencyKey } from "../lib/database";
import { refreshHistoricalBatch } from "../services/historical-imports";
import { releaseUploadUsage, reserveUploadUsage } from "../services/usage";

interface BatchRow {
  completed_at: number | null;
  created_at: number;
  duplicate_count: number;
  failed_count: number;
  id: string;
  needs_review_count: number;
  processed_files: number;
  status: HistoricalImportContract["status"];
  total_files: number;
  updated_at: number;
  verified_count: number;
}

const mapBatch = (row: BatchRow): HistoricalImportContract => ({
  completedAt: row.completed_at
    ? new Date(row.completed_at).toISOString()
    : null,
  createdAt: new Date(row.created_at).toISOString(),
  duplicateCount: row.duplicate_count,
  failedCount: row.failed_count,
  id: row.id,
  needsReviewCount: row.needs_review_count,
  processedFiles: row.processed_files,
  status: row.status,
  totalFiles: row.total_files,
  updatedAt: new Date(row.updated_at).toISOString(),
  verifiedCount: row.verified_count,
});

const loadBatch = (id: string, userId: string): Promise<BatchRow | null> =>
  env.DB.prepare(
    `SELECT completed_at, created_at, duplicate_count, failed_count, id,
      needs_review_count, processed_files, status, total_files, updated_at, verified_count
     FROM historical_import_batches WHERE id = ? AND user_id = ?`
  )
    .bind(id, userId)
    .first<BatchRow>();

const hasCreatorPlan = async (userId: string): Promise<boolean> => {
  const row = await env.DB.prepare(
    `SELECT 1 AS allowed FROM billing_entitlements
     WHERE user_id = ? AND plan = 'creator' AND status IN ('trialing', 'active', 'grace_period')
       AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`
  )
    .bind(userId, Date.now())
    .first<{ allowed: number }>();
  return row?.allowed === 1;
};

export const createHistoricalImportRoutes = (auth: Auth) =>
  new Hono()
    .post(
      "/historical-imports",
      zValidator("json", createHistoricalImportSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers);
        if (!user) {
          return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
        }
        if (!(await hasCreatorPlan(user.id))) {
          return c.json(
            {
              code: "CREATOR_REQUIRED",
              error: "Historical batch import requires Creator",
            },
            403
          );
        }
        const input = c.req.valid("json");
        const batchIdempotencyKey = scopeIdempotencyKey(
          user.id,
          input.idempotencyKey
        );
        const existing = await env.DB.prepare(
          "SELECT id FROM historical_import_batches WHERE user_id = ? AND idempotency_key = ?"
        )
          .bind(user.id, batchIdempotencyKey)
          .first<{ id: string }>();
        if (existing) {
          const batch = await loadBatch(existing.id, user.id);
          return c.json(
            { batch: batch ? mapBatch(batch) : null, uploads: [] },
            200
          );
        }
        const batchId = crypto.randomUUID();
        const now = Date.now();
        await env.DB.prepare(
          `INSERT INTO historical_import_batches (id, idempotency_key, status, total_files, updated_at, user_id)
         VALUES (?, ?, 'processing', ?, ?, ?)`
        )
          .bind(batchId, batchIdempotencyKey, input.files.length, now, user.id)
          .run();
        const uploads: { id: string; uploadUrl: string }[] = [];
        let duplicates = 0;
        for (const file of input.files) {
          const duplicate = await env.DB.prepare(
            "SELECT id FROM uploads WHERE user_id = ? AND sha256 = ? AND deleted_at IS NULL"
          )
            .bind(user.id, file.sha256.toLowerCase())
            .first<{ id: string }>();
          if (duplicate) {
            duplicates += 1;
            continue;
          }
          const uploadId = crypto.randomUUID();
          const scopedFileKey = scopeIdempotencyKey(
            user.id,
            file.idempotencyKey
          );
          const reservation = await reserveUploadUsage({
            db: env.DB,
            idempotencyKey: scopedFileKey,
            uploadId,
            userId: user.id,
          });
          if (!reservation.reserved) {
            await env.DB.prepare(
              "UPDATE historical_import_batches SET failed_count = failed_count + 1, updated_at = ? WHERE id = ?"
            )
              .bind(Date.now(), batchId)
              .run();
            continue;
          }
          try {
            await env.DB.prepare(
              `INSERT INTO uploads (file_size, historical_import_batch_id, id, ingestion_mode, mime_type,
              object_key, original_filename, retention_expires_at, sha256, status, updated_at,
              usage_reservation_key, user_id)
             VALUES (?, ?, ?, 'historical', ?, ?, ?, ?, ?, 'uploading', ?, ?, ?)`
            )
              .bind(
                file.size,
                batchId,
                uploadId,
                file.mimeType,
                `users/${user.id}/imports/${batchId}/${uploadId}`,
                file.originalFilename,
                now + 90 * 24 * 60 * 60 * 1000,
                file.sha256.toLowerCase(),
                now,
                scopedFileKey,
                user.id
              )
              .run();
            uploads.push({
              id: uploadId,
              uploadUrl: `/api/v1/uploads/${uploadId}/content`,
            });
          } catch (error) {
            await releaseUploadUsage(env.DB, scopedFileKey);
            throw error;
          }
        }
        await env.DB.prepare(
          "UPDATE historical_import_batches SET duplicate_count = ?, updated_at = ? WHERE id = ?"
        )
          .bind(duplicates, Date.now(), batchId)
          .run();
        await refreshHistoricalBatch(env.DB, batchId);
        const batch = await loadBatch(batchId, user.id);
        return c.json({ batch: batch ? mapBatch(batch) : null, uploads }, 201);
      }
    )
    .get("/historical-imports/:batchId", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      await refreshHistoricalBatch(env.DB, c.req.param("batchId"));
      const batch = await loadBatch(c.req.param("batchId"), user.id);
      if (!batch) {
        return c.json(
          { code: "NOT_FOUND", error: "Import batch not found" },
          404
        );
      }
      const uploads = await env.DB.prepare(
        `SELECT id, original_filename, status FROM uploads
         WHERE historical_import_batch_id = ? AND user_id = ? ORDER BY created_at`
      )
        .bind(batch.id, user.id)
        .all<{ id: string; original_filename: string; status: string }>();
      return c.json({
        batch: mapBatch(batch),
        uploads: uploads.results.map((row) => ({
          id: row.id,
          originalFilename: row.original_filename,
          status: row.status,
        })),
      });
    })
    .post("/historical-imports/:batchId/cancel", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const batch = await loadBatch(c.req.param("batchId"), user.id);
      if (!batch) {
        return c.json(
          { code: "NOT_FOUND", error: "Import batch not found" },
          404
        );
      }
      if (["completed", "failed", "cancelled"].includes(batch.status)) {
        return c.json(
          { code: "INVALID_STATE", error: "Import batch is already terminal" },
          409
        );
      }
      const cancelledAt = Date.now();
      const cancelled = await env.DB.prepare(
        `UPDATE historical_import_batches
         SET status = 'cancelled', completed_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ? AND status IN ('pending', 'processing')`
      )
        .bind(cancelledAt, cancelledAt, batch.id, user.id)
        .run();
      if (cancelled.meta.changes === 0) {
        return c.json(
          { code: "CONFLICT", error: "Import batch changed while cancelling" },
          409
        );
      }
      const pending = await env.DB.prepare(
        `SELECT object_key, usage_reservation_key FROM uploads
         WHERE historical_import_batch_id = ? AND user_id = ?
           AND status IN ('uploading', 'ready', 'processing')`
      )
        .bind(batch.id, user.id)
        .all<{ object_key: string; usage_reservation_key: string }>();
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE uploads SET status = 'failed', updated_at = ?
           WHERE historical_import_batch_id = ?
             AND status IN ('uploading', 'ready', 'processing')`
        ).bind(cancelledAt, batch.id),
        env.DB.prepare(
          `DELETE FROM tickets WHERE historical_import_batch_id = ?
           AND status IN ('draft', 'needs_review')`
        ).bind(batch.id),
      ]);
      for (const upload of pending.results) {
        await env.R2_UPLOADS.delete(upload.object_key);
        await releaseUploadUsage(env.DB, upload.usage_reservation_key);
      }
      const cancelledBatch = await loadBatch(batch.id, user.id);
      return c.json({
        batch: cancelledBatch ? mapBatch(cancelledBatch) : null,
      });
    });
