import { z } from "zod";

export const profileSchema = z.object({
  bio: z.string().nullable(),
  isPublic: z.boolean(),
  username: z.string(),
});

export const publicProfileSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
  bio: z.string().nullable(),
  followerCount: z.number().int().nonnegative().optional(),
  followers: z.number().int().nonnegative().optional(),
  image: z.string().nullable().optional(),
  losses: z.number().int().nonnegative(),
  name: z.string(),
  username: z.string(),
  wins: z.number().int().nonnegative(),
});

export const updateProfileRequestSchema = z.object({
  bio: z.string().trim().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/u)
    .optional(),
});

export type ProfileContract = z.infer<typeof profileSchema>;
export type PublicProfileContract = z.infer<typeof publicProfileSchema>;

export const communityVisibilitySchema = z.enum(["public", "private"]);
export const communityAccessSchema = z.enum(["free", "paid"]);
export const communityRoleSchema = z.enum(["owner", "moderator", "member"]);
export const communityMemberStatusSchema = z.enum([
  "active",
  "pending",
  "muted",
  "banned",
]);
export const communityReportStatusSchema = z.enum([
  "open",
  "resolved",
  "dismissed",
]);

const communitySlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const createCommunityRequestSchema = z.object({
  access: communityAccessSchema.default("free"),
  description: z.string().trim().max(2000).nullable().optional(),
  name: z.string().trim().min(2).max(80),
  priceCents: z.number().int().min(100).max(100_000).nullable().optional(),
  rules: z.string().trim().max(4000).nullable().optional(),
  slug: communitySlugSchema,
  visibility: communityVisibilitySchema.default("public"),
});

export const updateCommunityRequestSchema = z
  .object({
    access: communityAccessSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    name: z.string().trim().min(2).max(80).optional(),
    priceCents: z.number().int().min(100).max(100_000).nullable().optional(),
    rules: z.string().trim().max(4000).nullable().optional(),
    slug: communitySlugSchema.optional(),
    visibility: communityVisibilitySchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.access === "free" &&
      value.priceCents !== undefined &&
      value.priceCents !== null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Free communities cannot have a price",
        path: ["priceCents"],
      });
    }
    if (value.access === "paid" && value.priceCents === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid communities require a price",
        path: ["priceCents"],
      });
    }
  });

export const createCommunityChannelRequestSchema = z.object({
  description: z.string().trim().max(500).nullable().optional(),
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
});

export const updateCommunityChannelRequestSchema =
  createCommunityChannelRequestSchema.partial();

export const communityChatMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  clientId: z.string().trim().min(1).max(100),
  replyToId: z.string().uuid().nullable().optional(),
  type: z.literal("message"),
});

export const createCommunityReportRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const moderateCommunityMemberRequestSchema = z.object({
  role: communityRoleSchema.exclude(["owner"]).optional(),
  status: communityMemberStatusSchema.optional(),
});

export const resolveCommunityReportRequestSchema = z.object({
  status: communityReportStatusSchema.exclude(["open"]),
});

export type CreateCommunityRequest = z.infer<
  typeof createCommunityRequestSchema
>;
export type CommunityChatMessage = z.infer<typeof communityChatMessageSchema>;
