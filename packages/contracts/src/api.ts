import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.string(),
  error: z.string(),
  requestId: z.string().optional(),
});

export const cursorPageSchema = z.object({
  nextCursor: z.string().nullable(),
});

export const idempotencyKeySchema = z.string().trim().min(8).max(160);

export type ApiError = z.infer<typeof apiErrorSchema>;
