import { zValidator } from "@hono/zod-validator";
import type { Auth } from "@ppal/auth";
import type { ExtractionQueueMessage } from "@ppal/contracts/queues";
import { createUploadRequestSchema } from "@ppal/contracts/uploads";
import type { UploadContract } from "@ppal/contracts/uploads";
import { env } from "@ppal/env/server";
import { Hono } from "hono";

import { getAuthUser } from "../lib/auth";
import { toIsoString } from "../lib/time";
import { releaseUploadUsage, reserveUploadUsage } from "../services/usage";

interface UploadRow {
  created_at: number;
  error_message: string | null;
  id: string;
  ingestion_mode: "historical" | "live";
  mime_type: string | null;
  original_filename: string | null;
  ready_at: number | null;
  file_size: number | null;
  status: UploadContract["status"];
  ticket_id: string | null;
  updated_at: number;
}

const toContract = (row: UploadRow): UploadContract => ({
  createdAt: new Date(row.created_at).toISOString(),
  error: row.error_message,
  id: row.id,
  ingestionMode: row.ingestion_mode,
  mimeType: row.mime_type,
  originalFilename: row.original_filename,
  readyAt: toIsoString(row.ready_at),
  size: row.file_size,
  status: row.status,
  ticketId: row.ticket_id,
  updatedAt: new Date(row.updated_at).toISOString(),
});

const selectUpload = (
  db: D1Database,
  uploadId: string,
  userId: string
): Promise<UploadRow | null> =>
  db
    .prepare(
      `SELECT u.created_at, e.error_message, u.file_size, u.id,
        u.ingestion_mode, u.mime_type, u.original_filename, u.ready_at,
        u.status, t.id AS ticket_id, u.updated_at
      FROM uploads u
      LEFT JOIN extractions e ON e.id = (
        SELECT id FROM extractions WHERE upload_id = u.id
        ORDER BY created_at DESC LIMIT 1
      )
      LEFT JOIN tickets t ON t.source_upload_id = u.id
      WHERE u.id = ? AND u.user_id = ? AND u.deleted_at IS NULL`
    )
    .bind(uploadId, userId)
    .first<UploadRow>();

const hexToBuffer = (value: string): ArrayBuffer => {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes.buffer;
};

export const createUploadRoutes = (auth: Auth) =>
  new Hono()
    .post(
      "/intents",
      zValidator("json", createUploadRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers);
        if (!user) {
          return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
        }
        const input = c.req.valid("json");
        const existing = await env.DB.prepare(
          `SELECT id FROM uploads
         WHERE usage_reservation_key = ? AND user_id = ?`
        )
          .bind(input.idempotencyKey, user.id)
          .first<{ id: string }>();
        if (existing) {
          const row = await selectUpload(env.DB, existing.id, user.id);
          return row
            ? c.json(
                {
                  upload: toContract(row),
                  uploadUrl: `/api/v1/uploads/${row.id}/content`,
                },
                200
              )
            : c.json(
                { code: "INTERNAL_ERROR", error: "Upload could not be loaded" },
                500
              );
        }

        const uploadId = crypto.randomUUID();
        const reservation = await reserveUploadUsage({
          db: env.DB,
          idempotencyKey: input.idempotencyKey,
          uploadId,
          userId: user.id,
        });
        if (!reservation.reserved) {
          return c.json(
            { error: "Monthly upload limit reached", code: reservation.reason },
            429
          );
        }

        const now = Date.now();
        const objectKey = `users/${user.id}/uploads/${uploadId}`;
        try {
          await env.DB.prepare(
            `INSERT INTO uploads (
            file_size, id, ingestion_mode, mime_type, object_key,
            original_filename, retention_expires_at, sha256, status,
            updated_at, usage_reservation_key, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploading', ?, ?, ?)`
          )
            .bind(
              input.size,
              uploadId,
              input.ingestionMode,
              input.mimeType,
              objectKey,
              input.originalFilename,
              now + 90 * 24 * 60 * 60 * 1000,
              input.sha256.toLowerCase(),
              now,
              input.idempotencyKey,
              user.id
            )
            .run();
        } catch (error) {
          await releaseUploadUsage(env.DB, input.idempotencyKey);
          throw error;
        }
        const row = await selectUpload(env.DB, uploadId, user.id);
        if (!row) {
          return c.json(
            { code: "INTERNAL_ERROR", error: "Upload could not be created" },
            500
          );
        }
        return c.json(
          {
            upload: toContract(row),
            uploadUrl: `/api/v1/uploads/${uploadId}/content`,
          },
          201
        );
      }
    )
    .put("/:uploadId/content", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const upload = await env.DB.prepare(
        `SELECT file_size, id, mime_type, object_key, sha256, status
         FROM uploads WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
        .bind(c.req.param("uploadId"), user.id)
        .first<{
          file_size: number;
          id: string;
          mime_type: string;
          object_key: string;
          sha256: string;
          status: string;
        }>();
      if (!upload) {
        return c.json({ code: "NOT_FOUND", error: "Upload not found" }, 404);
      }
      if (upload.status !== "uploading") {
        if (["ready", "processing", "extracted"].includes(upload.status)) {
          return c.json({ accepted: true, uploadId: upload.id }, 202);
        }
        return c.json(
          {
            code: "INVALID_STATE",
            error: "Upload is cancelled, failed, or no longer writable",
          },
          409
        );
      }
      const contentLength = Number(c.req.header("content-length"));
      if (
        !Number.isSafeInteger(contentLength) ||
        contentLength !== upload.file_size
      ) {
        return c.json(
          {
            code: "SIZE_MISMATCH",
            error: "Content-Length does not match the declared size",
          },
          400
        );
      }
      if (c.req.header("content-type")?.split(";", 1)[0] !== upload.mime_type) {
        return c.json(
          {
            code: "MIME_MISMATCH",
            error: "Content-Type does not match the declared MIME type",
          },
          400
        );
      }
      if (!c.req.raw.body) {
        return c.json(
          { code: "BODY_REQUIRED", error: "Request body is required" },
          400
        );
      }
      await env.R2_UPLOADS.put(upload.object_key, c.req.raw.body, {
        customMetadata: { uploadId: upload.id, userId: user.id },
        httpMetadata: { contentType: upload.mime_type },
        sha256: hexToBuffer(upload.sha256),
      });
      const now = new Date();
      await env.DB.prepare(
        "UPDATE uploads SET status = 'ready', ready_at = ?, updated_at = ? WHERE id = ? AND status = 'uploading'"
      )
        .bind(now.getTime(), now.getTime(), upload.id)
        .run();
      const message: ExtractionQueueMessage = {
        attemptVersion: 1,
        requestedAt: now.toISOString(),
        uploadId: upload.id,
      };
      await env.EXTRACTION_QUEUE.send(message, { contentType: "json" });
      return c.json({ accepted: true, uploadId: upload.id }, 202);
    })
    .get("/:uploadId/content", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const upload = await env.DB.prepare(
        `SELECT mime_type, object_key FROM uploads
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
      )
        .bind(c.req.param("uploadId"), user.id)
        .first<{ mime_type: string; object_key: string }>();
      if (!upload) {
        return c.json({ code: "NOT_FOUND", error: "Upload not found" }, 404);
      }
      const object = await env.R2_UPLOADS.get(upload.object_key, {
        range: c.req.header("range") ?? undefined,
      });
      if (!object) {
        return c.json(
          { code: "NOT_FOUND", error: "Upload content not found" },
          404
        );
      }
      const headers = new Headers({
        "accept-ranges": "bytes",
        "cache-control": "private, no-store",
        "content-type": upload.mime_type,
        etag: object.httpEtag,
      });
      if (object.range) {
        const offset =
          "offset" in object.range ? (object.range.offset ?? 0) : 0;
        const length =
          "length" in object.range
            ? (object.range.length ?? object.size)
            : object.size;
        headers.set(
          "content-range",
          `bytes ${offset}-${offset + length - 1}/${object.size}`
        );
        headers.set("content-length", String(length));
        return new Response(object.body, { headers, status: 206 });
      }
      headers.set("content-length", String(object.size));
      return new Response(object.body, { headers });
    })
    .get("/:uploadId", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const row = await selectUpload(env.DB, c.req.param("uploadId"), user.id);
      return row
        ? c.json({ upload: toContract(row) }, 200)
        : c.json({ code: "NOT_FOUND", error: "Upload not found" }, 404);
    });
