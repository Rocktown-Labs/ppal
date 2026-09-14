import { z } from "zod";

export const extractionQueueMessageSchema = z.object({
  attemptVersion: z.literal(1),
  requestedAt: z.string().datetime(),
  uploadId: z.string().min(1),
});

export const sportsPollQueueMessageSchema = z.object({
  eventId: z.string().min(1),
  leaseToken: z.string().min(1),
});

export const notificationQueueMessageSchema = z.object({
  deliveryId: z.string().min(1),
});

export type ExtractionQueueMessage = z.infer<
  typeof extractionQueueMessageSchema
>;
export type NotificationQueueMessage = z.infer<
  typeof notificationQueueMessageSchema
>;
export type SportsPollQueueMessage = z.infer<
  typeof sportsPollQueueMessageSchema
>;
