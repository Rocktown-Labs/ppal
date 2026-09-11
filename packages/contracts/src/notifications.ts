import { z } from "zod";

export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  legLost: z.boolean(),
  legWon: z.boolean(),
  pushEnabled: z.boolean(),
  ticketLost: z.boolean(),
  ticketWon: z.boolean(),
});

export const notificationSchema = z.object({
  body: z.string(),
  createdAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()).nullable(),
  id: z.string(),
  readAt: z.string().datetime().nullable(),
  ticketId: z.string().nullable(),
  title: z.string(),
  type: z.string(),
});

export type NotificationContract = z.infer<typeof notificationSchema>;
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
