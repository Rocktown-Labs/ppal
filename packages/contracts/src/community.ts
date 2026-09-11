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
