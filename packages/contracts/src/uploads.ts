import { z } from "zod";

import { ingestionModeSchema, uploadStatusSchema } from "./tickets";

export const supportedUploadMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const createUploadRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(160),
  ingestionMode: ingestionModeSchema.default("live"),
  mimeType: z.enum(supportedUploadMimeTypes),
  originalFilename: z.string().trim().min(1).max(255),
  sha256: z.string().regex(/^[a-f\d]{64}$/iu),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

export const uploadContractSchema = z.object({
  createdAt: z.string().datetime(),
  error: z.string().nullable(),
  id: z.string().min(1),
  ingestionMode: ingestionModeSchema,
  mimeType: z.string().nullable(),
  originalFilename: z.string().nullable(),
  readyAt: z.string().datetime().nullable(),
  size: z.number().int().nullable(),
  status: uploadStatusSchema,
  ticketId: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export const extractionLegSchema = z.object({
  confidence: z.number().min(0).max(1).default(0),
  description: z.string().trim().min(1).max(500),
  eventHint: z.string().trim().max(240).nullable().default(null),
  league: z.string().trim().max(80).nullable().default(null),
  market: z.string().trim().min(1).max(160),
  marketComponents: z
    .array(z.string().trim().min(1).max(80))
    .max(8)
    .default([]),
  operator: z.enum([
    "over",
    "under",
    "gte",
    "lte",
    "equals",
    "moneyline",
    "spread",
    "yes",
    "no",
    "custom",
  ]),
  secondaryTargetValue: z.number().finite().nullable().default(null),
  sport: z.string().trim().max(80).nullable().default(null),
  subjectName: z.string().trim().min(1).max(160),
  subjectType: z.enum(["player", "team", "game"]),
  targetValue: z.number().finite().nullable().default(null),
});

export const extractionResultSchema = z.object({
  displayedResult: z
    .enum(["won", "lost", "push", "void"])
    .nullable()
    .default(null),
  legs: z.array(extractionLegSchema).min(1).max(50),
  sourceName: z.string().trim().max(120).nullable().default(null),
  ticketType: z
    .enum(["parlay", "single", "sgp", "teaser", "round_robin"])
    .default("parlay"),
});

export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type UploadContract = z.infer<typeof uploadContractSchema>;
