import { z } from "zod";

export const playerMarketAnalyticsSchema = z.object({
  hitRate: z.number(),
  lost: z.number().int(),
  market: z.string(),
  selections: z.number().int(),
  won: z.number().int(),
});

export const playerAnalyticsSchema = z.object({
  hitRate: z.number(),
  lost: z.number().int(),
  markets: z.array(playerMarketAnalyticsSchema),
  name: z.string(),
  participantId: z.string().nullable(),
  recentForm: z.array(z.enum(["W", "L"])),
  selections: z.number().int(),
  sport: z.string(),
  won: z.number().int(),
});

export type PlayerAnalyticsContract = z.infer<typeof playerAnalyticsSchema>;
