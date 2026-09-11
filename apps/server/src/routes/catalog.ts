import type { Auth } from "@ppal/auth";
import { env } from "@ppal/env/server";
import { Hono } from "hono";

import { getAuthUser } from "../lib/auth";

export const createCatalogRoutes = (auth: Auth) =>
  new Hono().get("/catalog/search", async (c) => {
    const user = await getAuthUser(auth, c.req.raw.headers);
    if (!user) {
      return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
    }
    const query = (c.req.query("q") ?? "").trim();
    if (query.length < 2) {
      return c.json(
        {
          code: "INVALID_QUERY",
          error: "Search requires at least two characters",
        },
        400
      );
    }
    const pattern = `%${query}%`;
    const [participants, markets, events] = await Promise.all([
      env.DB.prepare(
        `SELECT p.id, p.name, p.short_name, p.type, p.league_id, p.sport_id,
          l.name AS league_name, s.name AS sport_name
         FROM participants p JOIN sports s ON s.id = p.sport_id
         LEFT JOIN leagues l ON l.id = p.league_id
         WHERE p.name LIKE ? OR p.short_name LIKE ? ORDER BY p.name LIMIT 30`
      )
        .bind(pattern, pattern)
        .all<{
          id: string;
          league_id: string | null;
          league_name: string | null;
          name: string;
          short_name: string | null;
          sport_id: string;
          sport_name: string;
          type: string;
        }>(),
      env.DB.prepare(
        `SELECT m.id, m.name, m.slug, m.subject_type, m.value_type, m.sport_id
         FROM markets m WHERE m.name LIKE ? OR m.slug LIKE ? ORDER BY m.name LIMIT 30`
      )
        .bind(pattern, pattern)
        .all<{
          id: string;
          name: string;
          slug: string;
          sport_id: string | null;
          subject_type: string;
          value_type: string;
        }>(),
      env.DB.prepare(
        `SELECT e.id, e.provider_event_id, e.starts_at, e.status,
          home.name AS home_name, away.name AS away_name, l.name AS league_name
         FROM sports_events e JOIN leagues l ON l.id = e.league_id
         LEFT JOIN participants home ON home.id = e.home_participant_id
         LEFT JOIN participants away ON away.id = e.away_participant_id
         WHERE home.name LIKE ? OR away.name LIKE ? OR l.name LIKE ?
         ORDER BY e.starts_at DESC LIMIT 30`
      )
        .bind(pattern, pattern, pattern)
        .all<{
          away_name: string | null;
          home_name: string | null;
          id: string;
          league_name: string;
          provider_event_id: string;
          starts_at: number;
          status: string;
        }>(),
    ]);
    return c.json({
      events: events.results.map((event) => ({
        awayName: event.away_name,
        homeName: event.home_name,
        id: event.id,
        leagueName: event.league_name,
        providerEventId: event.provider_event_id,
        startsAt: new Date(event.starts_at).toISOString(),
        status: event.status,
      })),
      markets: markets.results.map((market) => ({
        id: market.id,
        name: market.name,
        slug: market.slug,
        sportId: market.sport_id,
        subjectType: market.subject_type,
        valueType: market.value_type,
      })),
      participants: participants.results.map((participant) => ({
        id: participant.id,
        leagueId: participant.league_id,
        leagueName: participant.league_name,
        name: participant.name,
        shortName: participant.short_name,
        sportId: participant.sport_id,
        sportName: participant.sport_name,
        type: participant.type,
      })),
    });
  });
