import { z } from "zod";

export const referralSchema = z.object({
  claimedAt: z.string().datetime().nullable(),
  code: z.string().length(8),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  id: z.string(),
  status: z.enum(["pending", "completed", "expired", "cancelled"]),
});

export const referralDashboardSchema = z.object({
  code: z.string().length(8),
  referrals: z.array(referralSchema),
  shareUrl: z.string().url(),
  summary: z.object({
    completed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
});

export const createReferralRequestSchema = z.object({});
export const claimReferralRequestSchema = z.object({});

export type ReferralContract = z.infer<typeof referralSchema>;
