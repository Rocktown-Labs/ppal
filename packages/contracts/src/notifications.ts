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

export const webPushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((value) => new URL(value).protocol === "https:", {
      message: "Push subscription endpoint must use HTTPS",
    }),
  keys: z.object({
    auth: z.string().min(1).max(256),
    p256dh: z.string().min(1).max(256),
  }),
});

export const webPushConfigSchema = z.object({
  enabled: z.boolean(),
  publicKey: z.string().nullable(),
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
export type WebPushSubscription = z.infer<typeof webPushSubscriptionSchema>;
export type WebPushConfig = z.infer<typeof webPushConfigSchema>;
