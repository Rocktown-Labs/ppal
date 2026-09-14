import { describe, expect, test } from "bun:test";

import {
  buildSportradarSummaryPath,
  collectRecords,
  findNumber,
  normalizeStatus,
  summaryScores,
} from "../src/services/sports";

const event = {
  away_participant_id: "away",
  away_score: null,
  home_participant_id: "home",
  home_score: null,
  id: "event",
  league_id: "league",
  league_slug: "nba",
  provider_event_id: "provider-event",
  sport_id: "sport",
  starts_at: Date.now(),
  status: "scheduled" as const,
};

describe("Sportradar provider normalization", () => {
  test("normalizes North American boxscores", () => {
    const payload = {
      game: {
        away: { points: 101 },
        home: { points: 110 },
        status: "closed",
      },
    };
    expect(normalizeStatus(payload, "scheduled")).toBe("final");
    expect(summaryScores(payload, event)).toEqual({ away: 101, home: 110 });
  });

  test("normalizes global sport-event summaries", () => {
    const payload = {
      sport_event_status: { away_score: 2, home_score: 3, status: "ended" },
    };
    expect(normalizeStatus(payload, "live")).toBe("final");
    expect(summaryScores(payload, event)).toEqual({ away: 2, home: 3 });
  });

  test("collects player, golfer, and driver result records", () => {
    const payload = {
      leaderboard: [{ id: "golfer-1", name: "Ada Golfer", position: 1 }],
      results: [
        {
          id: "driver-1",
          name: "Max Driver",
          result: { position: 2 },
        },
      ],
      team: {
        players: [
          {
            id: "player-1",
            name: "Pat Player",
            statistics: { assists: 6, points: 24, rebounds: 9 },
          },
        ],
      },
    };
    const records: Record<string, unknown>[] = [];
    collectRecords(payload, records);
    expect(records.map((record) => record.id)).toEqual([
      "golfer-1",
      "driver-1",
      "player-1",
    ]);
    const player = records.find((record) => record.id === "player-1");
    expect(findNumber(player, ["points"])).toBe(24);
    expect(
      ["points", "rebounds", "assists"].reduce(
        (total, key) => total + (findNumber(player, [key]) ?? 0),
        0
      )
    ).toBe(39);
  });

  test("switches every supported summary feed between trial and production", () => {
    const leagueSlugs = [
      "f1",
      "global_american_football",
      "global_baseball",
      "global_basketball",
      "global_ice_hockey",
      "mlb",
      "nascar",
      "nba",
      "ncaafb",
      "ncaamb",
      "ncaawb",
      "nfl",
      "nhl",
      "pga",
      "soccer",
      "tennis",
      "ufc",
      "wnba",
    ];
    for (const leagueSlug of leagueSlugs) {
      const path = buildSportradarSummaryPath(
        {
          league_slug: leagueSlug,
          provider_event_id: "event/id",
          starts_at: Date.UTC(2026, 8, 12),
        },
        "production"
      );
      expect(path).not.toContain("/trial/");
      expect(path).toContain("event%2Fid");
    }
  });

  test("uses football boxscores and the official NFL path", () => {
    expect(
      buildSportradarSummaryPath(
        {
          league_slug: "nfl",
          provider_event_id: "game-id",
          starts_at: Date.UTC(2026, 8, 12),
        },
        "trial"
      )
    ).toBe("nfl/official/trial/v7/en/games/game-id/boxscore.json");
    expect(
      buildSportradarSummaryPath(
        {
          league_slug: "ncaafb",
          provider_event_id: "game-id",
          starts_at: Date.UTC(2026, 8, 12),
        },
        "trial"
      )
    ).toBe("ncaafb/trial/v7/en/games/game-id/boxscore.json");
  });
});
