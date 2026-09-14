import { z } from "zod";

export const billingEntitlementSchema = z.object({
  currentPeriodEnd: z.string().datetime().nullable(),
  plan: z.enum(["free", "pro", "creator"]),
  source: z.enum(["stripe", "revenuecat", "manual"]).nullable(),
  status: z.string(),
});

export const billingEntitlementResponseSchema = z.object({
  entitlement: billingEntitlementSchema,
});

export type BillingEntitlementContract = z.infer<
  typeof billingEntitlementSchema
>;
