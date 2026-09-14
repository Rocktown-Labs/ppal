import { z } from "zod";

export const operationFailureSchema = z.object({
  attempts: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  error: z.string(),
  id: z.string(),
  messageId: z.string(),
  payload: z.unknown(),
  queue: z.string(),
  replayedAt: z.string().datetime().nullable(),
  status: z.enum(["failed", "replayed", "resolved"]),
  updatedAt: z.string().datetime(),
});

export const replayFailuresRequestSchema = z.object({
  failureIds: z.array(z.string()).min(1).max(100),
});

export type OperationFailureContract = z.infer<typeof operationFailureSchema>;
