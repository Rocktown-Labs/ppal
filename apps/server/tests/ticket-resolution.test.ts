import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { resolveExtractedLeg } from "../src/services/ticket-resolution";

const createTestDatabase = (): D1Database => {
  const sqlite = new Database(":memory:");
  sqlite.run(`
    CREATE TABLE sports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE
    );
    CREATE TABLE leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_key TEXT,
      slug TEXT NOT NULL UNIQUE,
      sport_id TEXT NOT NULL,
      updated_at INTEGER
    );
    CREATE TABLE participants (
      id TEXT PRIMARY KEY,
      league_id TEXT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_participant_id TEXT,
      short_name TEXT,
      sport_id TEXT NOT NULL,
      type TEXT NOT NULL,
      updated_at INTEGER
    );
    CREATE TABLE markets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sport_id TEXT,
      subject_type TEXT NOT NULL,
      value_type TEXT NOT NULL,
      updated_at INTEGER
    );
    CREATE TABLE sports_events (
      id TEXT PRIMARY KEY,
      away_participant_id TEXT,
      home_participant_id TEXT,
      league_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_event_id TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      updated_at INTEGER
    );
  `);

  sqlite.run(`
    INSERT INTO sports (id, name, slug) VALUES ('sport:football', 'Football', 'football');
    INSERT INTO leagues (id, name, provider, provider_key, slug, sport_id, updated_at)
    VALUES ('league:nfl', 'NFL', 'sportradar', 'nfl', 'nfl', 'sport:football', 1000);

    INSERT INTO markets (id, name, slug, subject_type, value_type, updated_at)
    VALUES ('market:team_moneyline', 'Team Moneyline', 'team_moneyline', 'team', 'moneyline', 1000),
           ('market:game_total', 'Game Total', 'game_total', 'game', 'numeric', 1000);

    INSERT INTO participants (id, league_id, name, provider, provider_participant_id, short_name, sport_id, type, updated_at)
    VALUES ('part:kc', 'league:nfl', 'Kansas City Chiefs', 'sportradar', 'sr:kc', 'KC', 'sport:football', 'team', 1000),
           ('part:bal', 'league:nfl', 'Baltimore Ravens', 'sportradar', 'sr:bal', 'BAL', 'sport:football', 'team', 1000);

    INSERT INTO sports_events (id, away_participant_id, home_participant_id, league_id, provider, provider_event_id, starts_at, status, updated_at)
    VALUES ('event:kc_bal', 'part:bal', 'part:kc', 'league:nfl', 'sportradar', 'sr:event:1', 1750000000000, 'scheduled', 1000);
  `);

  return {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => {
        const stmt = sqlite.query(sql);
        return {
          all: () =>
            Promise.resolve({
              results: stmt.all(
                ...(args as (string | number | null)[])
              ) as unknown[],
            }),
          first: () =>
            Promise.resolve(
              (stmt.get(...(args as (string | number | null)[])) as unknown) ??
                null
            ),
          run: () => {
            const res = stmt.run(...(args as (string | number | null)[]));
            return Promise.resolve({ meta: { changes: res.changes } });
          },
        };
      },
    }),
  } as unknown as D1Database;
};

describe("ticket resolution service", () => {
  test("resolves a full team moneyline selection with scheduled event", async () => {
    const db = createTestDatabase();
    const resolution = await resolveExtractedLeg(db, {
      confidence: 0.98,
      description: "Kansas City Chiefs moneyline",
      eventHint: "vs Ravens",
      league: "NFL",
      market: "team_moneyline",
      marketComponents: [],
      operator: "moneyline",
      secondaryTargetValue: null,
      sport: "football",
      subjectName: "Kansas City Chiefs",
      subjectType: "team",
      targetValue: null,
    });

    expect(resolution.resolverStatus).toBe("resolved");
    expect(resolution.marketId).toBe("market:team_moneyline");
    expect(resolution.participantId).toBe("part:kc");
    expect(resolution.sportsEventId).toBe("event:kc_bal");
    expect(resolution.leagueId).toBe("league:nfl");
    expect(resolution.sportId).toBe("sport:football");
  });

  test("resolves a team selection by nickname and event hint", async () => {
    const db = createTestDatabase();
    const resolution = await resolveExtractedLeg(db, {
      confidence: 0.95,
      description: "Chiefs ML",
      eventHint: "Chiefs vs Ravens",
      league: "NFL",
      market: "moneyline",
      marketComponents: [],
      operator: "moneyline",
      secondaryTargetValue: null,
      sport: "football",
      subjectName: "Chiefs",
      subjectType: "team",
      targetValue: null,
    });

    expect(resolution.resolverStatus).toBe("resolved");
    expect(resolution.marketId).toBe("market:team_moneyline");
    expect(resolution.participantId).toBe("part:kc");
    expect(resolution.sportsEventId).toBe("event:kc_bal");
  });

  test("marks leg as not_found when participant is not in catalog", async () => {
    const db = createTestDatabase();
    const resolution = await resolveExtractedLeg(db, {
      confidence: 0.9,
      description: "Tokyo Samurai ML",
      eventHint: null,
      league: "NFL",
      market: "team_moneyline",
      marketComponents: [],
      operator: "moneyline",
      secondaryTargetValue: null,
      sport: "football",
      subjectName: "Tokyo Samurai",
      subjectType: "team",
      targetValue: null,
    });

    expect(resolution.resolverStatus).toBe("not_found");
    expect(resolution.participantId).toBeNull();
    expect(resolution.sportsEventId).toBeNull();
  });

  test("marks leg as unsupported when market does not match catalog", async () => {
    const db = createTestDatabase();
    const resolution = await resolveExtractedLeg(db, {
      confidence: 0.8,
      description: "Coin toss heads",
      eventHint: null,
      league: "NFL",
      market: "coin_toss",
      marketComponents: [],
      operator: "yes",
      secondaryTargetValue: null,
      sport: "football",
      subjectName: "Coin",
      subjectType: "game",
      targetValue: null,
    });

    expect(resolution.resolverStatus).toBe("unsupported");
    expect(resolution.marketId).toBeNull();
  });

  test("marks game leg as ambiguous awaiting game selection", async () => {
    const db = createTestDatabase();
    const resolution = await resolveExtractedLeg(db, {
      confidence: 0.9,
      description: "Over 48.5 Total Points",
      eventHint: "Chiefs @ Ravens",
      league: "NFL",
      market: "game_total",
      marketComponents: [],
      operator: "over",
      secondaryTargetValue: null,
      sport: "football",
      subjectName: "Chiefs @ Ravens",
      subjectType: "game",
      targetValue: 48.5,
    });

    expect(resolution.resolverStatus).toBe("ambiguous");
    expect(resolution.marketId).toBe("market:game_total");
    expect(resolution.participantId).toBeNull();
  });
});
