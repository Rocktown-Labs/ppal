import { describe, expect, test } from "bun:test";

import {
  resolveSportSlugFromHint,
  toSportsApiSportPath,
} from "../src/services/schedules";
import {
  buildSportsApiLineupsPath,
  buildSportsApiMatchPath,
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
  provider_event_id: "16607282",
  sport_id: "sport:basketball",
  starts_at: Date.now(),
  status: "scheduled" as const,
};

describe("SportsAPI Pro V2 provider normalization", () => {
  test("normalizes SportsAPI Pro V2 match statuses and scores", () => {
    const livePayload = {
      event: {
        awayScore: { current: 74, display: 74 },
        homeScore: { current: 96, display: 96 },
        status: { code: 30, type: "inprogress" },
      },
    };
    expect(normalizeStatus(livePayload, "scheduled")).toBe("live");
    expect(summaryScores(livePayload, event)).toEqual({ away: 74, home: 96 });

    const finalPayload = {
      event: {
        awayScore: { current: 101, display: 101 },
        homeScore: { current: 110, display: 110 },
        status: { code: 100, type: "finished" },
      },
    };
    expect(normalizeStatus(finalPayload, "live")).toBe("final");
    expect(summaryScores(finalPayload, event)).toEqual({
      away: 101,
      home: 110,
    });
  });

  test("collects SportsAPI Pro V2 lineup boxscore player statistics", () => {
    const payload = {
      lineups: {
        home: {
          players: [
            {
              player: { id: 83_999, name: "Pat Player" },
              statistics: { assists: 6, points: 24, rebounds: 9 },
            },
          ],
        },
      },
    };
    const records: Record<string, unknown>[] = [];
    collectRecords(payload, records);
    expect(records.map((record) => record.id)).toEqual(["83999"]);
    const [player] = records;
    expect(findNumber(player, ["points"])).toBe(24);
    expect(
      ["points", "rebounds", "assists"].reduce(
        (total, key) => total + (findNumber(player, [key]) ?? 0),
        0
      )
    ).toBe(39);
  });

  test("builds V2 match and lineups endpoints across supported sports", () => {
    expect(buildSportsApiMatchPath("basketball", "16607282")).toBe(
      "/v2/basketball/api/match/16607282"
    );
    expect(buildSportsApiLineupsPath("basketball", "16607282")).toBe(
      "/v2/basketball/api/match/16607282/lineups"
    );
    expect(buildSportsApiMatchPath("football", "9911")).toBe(
      "/v2/american-football/api/match/9911"
    );
    expect(buildSportsApiMatchPath("soccer", "5544")).toBe(
      "/v2/football/api/match/5544"
    );
    expect(buildSportsApiMatchPath("racing", "777")).toBe(
      "/v2/motorsport/api/match/777"
    );
  });

  test("resolves sport slugs from slip hints for reactive schedule hydration", () => {
    expect(resolveSportSlugFromHint("NBA", null)).toBe("basketball");
    expect(resolveSportSlugFromHint(null, "NCAA Men's Basketball")).toBe(
      "basketball"
    );
    expect(resolveSportSlugFromHint("NFL", null)).toBe("football");
    expect(resolveSportSlugFromHint("Premier League", null)).toBe("soccer");
    expect(toSportsApiSportPath("football")).toBe("american-football");
  });
});
