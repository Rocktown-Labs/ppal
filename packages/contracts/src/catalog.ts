import { z } from "zod";

export const catalogSearchResponseSchema = z.object({
  events: z.array(
    z.object({
      awayName: z.string().nullable(),
      homeName: z.string().nullable(),
      id: z.string(),
      leagueName: z.string().nullable(),
      providerEventId: z.string(),
      startsAt: z.string().datetime(),
      status: z.string(),
    })
  ),
  markets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      sportId: z.string().nullable(),
      subjectType: z.enum(["player", "team", "game"]),
      valueType: z.string(),
    })
  ),
  participants: z.array(
    z.object({
      id: z.string(),
      leagueId: z.string().nullable(),
      leagueName: z.string().nullable(),
      name: z.string(),
      shortName: z.string().nullable(),
      sportId: z.string(),
      sportName: z.string(),
      type: z.enum(["player", "team"]),
    })
  ),
});

export type CatalogSearchResponse = z.infer<typeof catalogSearchResponseSchema>;
