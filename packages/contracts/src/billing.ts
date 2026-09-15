import { z } from "zod";

export const webSubscriptionPlans = {
  creator: {
    annualLookupKey: "parlaypal_creator_yearly",
    annualPriceCents: 19_900,
    description:
      "Bulk imports, creator analytics, and the highest priority processing.",
    displayName: "ParlayPal Creator",
    lookupKey: "parlaypal_creator_monthly",
    monthlyPriceCents: 2499,
    monthlyUploads: 1000,
    productKey: "creator",
  },
  pro: {
    annualLookupKey: "parlaypal_pro_yearly",
    annualPriceCents: 9999,
    description:
      "More ticket volume, fast live updates, analytics, and email alerts.",
    displayName: "ParlayPal Pro",
    lookupKey: "parlaypal_pro_monthly",
    monthlyPriceCents: 1299,
    monthlyUploads: 500,
    productKey: "pro",
  },
} as const;

export type WebSubscriptionPlan = keyof typeof webSubscriptionPlans;

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
