import type { Auth } from "@ppal/auth";
import { env } from "@ppal/env/server";
import { Hono } from "hono";

import { getAuthDiagnostics, getAuthUser } from "../lib/auth";

interface PlayerSummaryRow {
  hit_rate: number;
  lost: number;
  name: string;
  participant_id: string | null;
  selections: number;
  sport: string;
  won: number;
}

const playerSummarySql = `SELECT l.participant_id,
  COALESCE(p.name, l.subject_name) AS name, COALESCE(s.name, 'General') AS sport,
  COUNT(*) AS selections,
  SUM(CASE WHEN l.status = 'won' THEN 1 ELSE 0 END) AS won,
  SUM(CASE WHEN l.status = 'lost' THEN 1 ELSE 0 END) AS lost,
  CASE WHEN SUM(CASE WHEN l.status IN ('won', 'lost') THEN 1 ELSE 0 END) = 0 THEN 0
    ELSE ROUND(100.0 * SUM(CASE WHEN l.status = 'won' THEN 1 ELSE 0 END) /
      SUM(CASE WHEN l.status IN ('won', 'lost') THEN 1 ELSE 0 END), 1) END AS hit_rate
 FROM ticket_legs l JOIN tickets t ON t.id = l.ticket_id
 LEFT JOIN participants p ON p.id = l.participant_id LEFT JOIN sports s ON s.id = l.sport_id
 WHERE t.user_id = ? AND l.subject_type = 'player' AND t.status NOT IN ('draft', 'needs_review')`;

const mapPlayer = (row: PlayerSummaryRow) => ({
  hitRate: row.hit_rate,
  lost: row.lost,
  name: row.name,
  participantId: row.participant_id,
  selections: row.selections,
  sport: row.sport,
  won: row.won,
});

export const createAnalyticsRoutes = (auth: Auth) =>
  new Hono()
    .get("/analytics/overview", async (c) => {
      if (c.req.query("debug") === "auth") {
        return c.json(await getAuthDiagnostics(auth, c.req.raw));
      }
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const summary = await env.DB.prepare(
        `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) AS lost,
        SUM(CASE WHEN status IN ('scheduled', 'live') THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS verified
       FROM tickets WHERE user_id = ?`
      )
        .bind(user.id)
        .first<{
          active: number;
          lost: number;
          total: number;
          verified: number;
          won: number;
        }>();
      const settled = (summary?.won ?? 0) + (summary?.lost ?? 0);
      return c.json({
        overview: {
          active: summary?.active ?? 0,
          lost: summary?.lost ?? 0,
          total: summary?.total ?? 0,
          verified: summary?.verified ?? 0,
          winRate: settled > 0 ? (summary?.won ?? 0) / settled : null,
          won: summary?.won ?? 0,
        },
      });
    })
    .get("/analytics/players", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const rows = await env.DB.prepare(
        `${playerSummarySql} GROUP BY COALESCE(l.participant_id, lower(l.subject_name)) ORDER BY selections DESC LIMIT 100`
      )
        .bind(user.id)
        .all<PlayerSummaryRow>();
      return c.json({ players: rows.results.map(mapPlayer) });
    })
    .get("/analytics/players/:participantId", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const participantId = c.req.param("participantId");
      const summary = await env.DB.prepare(
        `${playerSummarySql} AND l.participant_id = ? GROUP BY l.participant_id`
      )
        .bind(user.id, participantId)
        .first<PlayerSummaryRow>();
      if (!summary) {
        return c.json(
          { code: "NOT_FOUND", error: "Player analytics not found" },
          404
        );
      }
      const markets = await env.DB.prepare(
        `SELECT COALESCE(m.name, l.raw_market_name, 'Other') AS market, COUNT(*) AS selections,
          SUM(CASE WHEN l.status = 'won' THEN 1 ELSE 0 END) AS won,
          SUM(CASE WHEN l.status = 'lost' THEN 1 ELSE 0 END) AS lost
         FROM ticket_legs l JOIN tickets t ON t.id = l.ticket_id LEFT JOIN markets m ON m.id = l.market_id
         WHERE t.user_id = ? AND l.participant_id = ? GROUP BY COALESCE(m.name, l.raw_market_name, 'Other')
         ORDER BY selections DESC`
      )
        .bind(user.id, participantId)
        .all<{
          lost: number;
          market: string;
          selections: number;
          won: number;
        }>();
      const recent = await env.DB.prepare(
        `SELECT l.status FROM ticket_legs l JOIN tickets t ON t.id = l.ticket_id
         WHERE t.user_id = ? AND l.participant_id = ? AND l.status IN ('won', 'lost')
         ORDER BY l.settled_at DESC LIMIT 5`
      )
        .bind(user.id, participantId)
        .all<{ status: "lost" | "won" }>();
      return c.json({
        player: {
          ...mapPlayer(summary),
          markets: markets.results.map((market) => ({
            hitRate:
              market.won + market.lost > 0
                ? Math.round((market.won / (market.won + market.lost)) * 1000) /
                  10
                : 0,
            lost: market.lost,
            market: market.market,
            selections: market.selections,
            won: market.won,
          })),
          recentForm: recent.results.map(({ status }) =>
            status === "won" ? ("W" as const) : ("L" as const)
          ),
        },
      });
    });
