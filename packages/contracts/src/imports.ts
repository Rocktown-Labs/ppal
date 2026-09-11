import { z } from "zod";

import { idempotencyKeySchema } from "./api";
import { supportedUploadMimeTypes } from "./uploads";

export const historicalImportFileSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  mimeType: z.enum(supportedUploadMimeTypes),
  originalFilename: z.string().trim().min(1).max(255),
  sha256: z.string().regex(/^[a-f\d]{64}$/iu),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

export const createHistoricalImportSchema = z.object({
  files: z.array(historicalImportFileSchema).min(1).max(100),
  idempotencyKey: idempotencyKeySchema,
});

export const historicalImportSchema = z.object({
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  duplicateCount: z.number().int(),
  failedCount: z.number().int(),
  id: z.string(),
  needsReviewCount: z.number().int(),
  processedFiles: z.number().int(),
  status: z.enum(["pending", "processing", "completed", "failed", "cancelled"]),
  totalFiles: z.number().int(),
  updatedAt: z.string().datetime(),
  verifiedCount: z.number().int(),
});

export const manualVerificationSchema = z.object({
  legs: z
    .array(
      z.object({
        id: z.string(),
        status: z.enum(["won", "lost", "push", "void"]),
        value: z.number().finite().nullable().default(null),
      })
    )
    .min(1)
    .max(100),
  source: z.enum(["settled_slip", "manual"]).default("settled_slip"),
});

export type HistoricalImportContract = z.infer<typeof historicalImportSchema>;
