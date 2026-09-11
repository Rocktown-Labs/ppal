/* oxlint-disable no-await-in-loop -- Sequential provider calls protect the upstream rate limit. */

const leagues = [
  ["nba", "NBA", "basketball"],
  ["wnba", "WNBA", "basketball"],
  ["ncaamb", "NCAA Men's Basketball", "basketball"],
  ["ncaawb", "NCAA Women's Basketball", "basketball"],
  ["nfl", "NFL", "football"],
  ["ncaafb", "NCAA Football", "football"],
  ["mlb", "MLB", "baseball"],
  ["nhl", "NHL", "hockey"],
  ["soccer", "Soccer", "soccer"],
  ["ufc", "UFC", "mma"],
  ["tennis", "Tennis", "tennis"],
  ["global_basketball", "Global Basketball", "basketball"],
  ["global_american_football", "Global American Football", "football"],
  ["global_ice_hockey", "Global Ice Hockey", "hockey"],
  ["global_baseball", "Global Baseball", "baseball"],
  ["nascar", "NASCAR Cup", "racing"],
  ["f1", "Formula 1", "racing"],
  ["pga", "PGA Tour", "golf"],
] as const;

const marketNames: Record<string, string> = {
  finish_position: "Finish Position",
  game_total: "Game Total",
  leaderboard_position: "Leaderboard Position",
  player_aces: "Player Aces",
  player_assists: "Player Assists",
  player_breakpoints_won: "Player Break Points Won",
  player_double_faults: "Player Double Faults",
  player_goals: "Player Goals",
  player_goals_scored: "Player Goals Scored",
  player_hits: "Player Hits",
  player_home_runs: "Player Home Runs",
  player_knockdowns: "Player Knockdowns",
  player_passing_rushing_yards: "Player Passing + Rushing Yards",
  player_passing_touchdowns: "Player Passing Touchdowns",
  player_points: "Player Points",
  player_points_assists: "Player Points + Assists",
  player_points_rebounds: "Player Points + Rebounds",
  player_points_rebounds_assists: "Player Points + Rebounds + Assists",
  player_rbi: "Player RBI",
  player_rebounds: "Player Rebounds",
  player_rebounds_assists: "Player Rebounds + Assists",
  player_receiving_yards: "Player Receiving Yards",
  player_runs: "Player Runs",
  player_rushing_yards: "Player Rushing Yards",
  player_shots: "Player Shots",
  player_shots_on_target: "Player Shots on Target",
  player_significant_strikes: "Player Significant Strikes",
  player_takedowns: "Player Takedowns",
  player_three_pointers_made: "Player Three-Pointers Made",
  player_total_shots: "Player Total Shots",
  race_winner: "Race Winner",
  team_moneyline: "Team Moneyline",
  team_spread: "Team Spread",
  tournament_winner: "Tournament Winner",
};

interface SchedulePlaybook {
  followupPaths?: (payload: Record<string, unknown>, date: Date) => string[];
  path: (date: Date) => string;
  rows: (payload: Record<string, unknown>) => Record<string, unknown>[];
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const itemRecord = record(item);
        return itemRecord ? [itemRecord] : [];
      })
    : [];

const dateParts = (
  date: Date
): { day: string; iso: string; month: string; year: string } => ({
  day: String(date.getUTCDate()).padStart(2, "0"),
  iso: date.toISOString().slice(0, 10),
  month: String(date.getUTCMonth() + 1).padStart(2, "0"),
  year: String(date.getUTCFullYear()),
});

const americanRows = (payload: Record<string, unknown>) =>
  records(payload.games);
const sportEventRows = (key: string) => (payload: Record<string, unknown>) =>
  records(payload[key]).flatMap((row) => {
    const event = record(row.sport_event);
    return event ? [event] : [];
  });

const dailyAmerican = (
  league: string,
  version: string,
  suffix = "schedule.json"
): SchedulePlaybook => ({
  path: (date) => {
    const { day, month, year } = dateParts(date);
    return `${league}/trial/${version}/en/games/${year}/${month}/${day}/${suffix}`;
  },
  rows: americanRows,
});

const footballWeek = (date: Date): string => {
  const septemberFirst = new Date(Date.UTC(date.getUTCFullYear(), 8, 1));
  const daysUntilThursday = (4 - septemberFirst.getUTCDay() + 7) % 7;
  const seasonStart = new Date(
    septemberFirst.getTime() + daysUntilThursday * 24 * 60 * 60 * 1000
  );
  const elapsedWeeks = Math.floor(
    (date.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  return String(Math.min(Math.max(elapsedWeeks + 1, 1), 18)).padStart(2, "0");
};

const playbooks: Record<string, SchedulePlaybook> = {
  f1: {
    followupPaths: (payload, date) =>
      records(payload.seasons)
        .filter(
          (season) =>
            Number(season.year) === date.getUTCFullYear() &&
            typeof season.id === "string"
        )
        .map(
          (season) =>
            `formula1/trial/v2/en/seasons/${String(season.id)}/stages/schedule.json`
        ),
    path: () => "formula1/trial/v2/en/seasons.json",
    rows: (payload) =>
      records(payload.stages).filter((stage) => stage.type === "race"),
  },
  global_american_football: {
    path: (date) =>
      `americanfootball/trial/v2/en/schedules/${dateParts(date).iso}/summaries.json`,
    rows: sportEventRows("summaries"),
  },
  global_baseball: {
    path: (date) =>
      `baseball/trial/v2/en/schedules/${dateParts(date).iso}/summaries.json?start=0&limit=100`,
    rows: sportEventRows("summaries"),
  },
  global_basketball: {
    path: (date) =>
      `basketball/trial/v2/en/schedules/${dateParts(date).iso}/summaries.json`,
    rows: sportEventRows("summaries"),
  },
  global_ice_hockey: {
    path: (date) =>
      `icehockey/trial/v2/en/schedules/${dateParts(date).iso}/summaries.json`,
    rows: sportEventRows("summaries"),
  },
  mlb: dailyAmerican("mlb", "v8"),
  nascar: {
    path: (date) => `nascar-ot3/mc/${dateParts(date).year}/races/schedule.json`,
    rows: (payload) => records(payload.races),
  },
  nba: dailyAmerican("nba", "v8"),
  ncaafb: {
    path: (date) =>
      `ncaafb/trial/v7/en/games/${dateParts(date).year}/REG/${footballWeek(date)}/schedule.json`,
    rows: americanRows,
  },
  ncaamb: dailyAmerican("ncaamb", "v8"),
  ncaawb: dailyAmerican("ncaawb", "v8"),
  nfl: {
    path: (date) =>
      `nfl/official/trial/v7/en/games/${dateParts(date).year}/REG/${footballWeek(date)}/schedule.json`,
    rows: americanRows,
  },
  nhl: dailyAmerican("nhl", "v7"),
  pga: {
    path: (date) =>
      `golf/pga/trial/v3/en/${dateParts(date).year}/tournaments/schedule.json`,
    rows: (payload) => records(payload.tournaments),
  },
  soccer: {
    path: (date) =>
      `soccer-extended/trial/v4/en/schedules/${dateParts(date).iso}/schedules.json`,
    rows: sportEventRows("schedules"),
  },
  tennis: {
    path: (date) =>
      `tennis/trial/v3/en/schedules/${dateParts(date).iso}/summaries.json`,
    rows: sportEventRows("summaries"),
  },
  ufc: {
    path: (date) =>
      `mma/trial/v2/en/schedules/${dateParts(date).iso}/summaries.json`,
    rows: sportEventRows("summaries"),
  },
  wnba: dailyAmerican("wnba", "v8"),
};

const normalizeEventStatus = (value: unknown): string => {
  const status = String(value ?? "scheduled").toLowerCase();
  if (["closed", "complete", "final", "ended"].includes(status)) {
    return "final";
  }
  if (["inprogress", "live", "started"].includes(status)) {
    return "live";
  }
  if (["postponed", "cancelled"].includes(status)) {
    return status;
  }
  return "scheduled";
};

const upsertTeam = async ({
  data,
  leagueId,
  sportId,
  workerEnv,
}: {
  data: Record<string, unknown>;
  leagueId: string;
  sportId: string;
  workerEnv: Env;
}): Promise<string | null> => {
  const providerId = String(data.id ?? data.sr_id ?? "");
  const name = String(data.name ?? data.full_name ?? "");
  if (!(providerId && name)) {
    return null;
  }
  const id = `participant:${providerId}`;
  await workerEnv.DB.prepare(
    `INSERT INTO participants (
      id, league_id, name, provider, provider_participant_id, short_name,
      sport_id, type, updated_at
    ) VALUES (?, ?, ?, 'sportradar', ?, ?, ?, 'team', ?)
    ON CONFLICT(provider, provider_participant_id) DO UPDATE SET
      league_id = excluded.league_id, name = excluded.name,
      short_name = excluded.short_name, sport_id = excluded.sport_id,
      updated_at = excluded.updated_at`
  )
    .bind(
      id,
      leagueId,
      name,
      providerId,
      String(data.alias ?? data.abbreviation ?? name),
      sportId,
      Date.now()
    )
    .run();
  return id;
};

const upsertScheduleEvent = async (
  raw: Record<string, unknown>,
  leagueSlug: string,
  sportSlug: string,
  workerEnv: Env
): Promise<void> => {
  const providerId = String(raw.id ?? raw.sr_id ?? "");
  const startsAtRaw = raw.scheduled ?? raw.start_time;
  const startsAt = new Date(String(startsAtRaw ?? ""));
  if (!(providerId && Number.isFinite(startsAt.getTime()))) {
    return;
  }
  const leagueId = `league:${leagueSlug}`;
  const sportId = `sport:${sportSlug}`;
  const competitors = records(raw.competitors);
  const homeRaw =
    record(raw.home) ??
    competitors.find((item) => item.qualifier === "home") ??
    null;
  const awayRaw =
    record(raw.away) ??
    competitors.find((item) => item.qualifier === "away") ??
    null;
  const homeId = homeRaw
    ? await upsertTeam({ data: homeRaw, leagueId, sportId, workerEnv })
    : null;
  const awayId = awayRaw
    ? await upsertTeam({ data: awayRaw, leagueId, sportId, workerEnv })
    : null;
  await workerEnv.DB.prepare(
    `INSERT INTO sports_events (
      away_participant_id, home_participant_id, id, league_id, next_poll_at,
      provider, provider_event_id, provider_payload, starts_at, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'sportradar', ?, ?, ?, ?, ?)
    ON CONFLICT(provider, provider_event_id) DO UPDATE SET
      away_participant_id = excluded.away_participant_id,
      home_participant_id = excluded.home_participant_id,
      league_id = excluded.league_id, provider_payload = excluded.provider_payload,
      starts_at = excluded.starts_at, updated_at = excluded.updated_at`
  )
    .bind(
      awayId,
      homeId,
      `event:${providerId}`,
      leagueId,
      startsAt.getTime() - 5 * 60 * 1000,
      providerId,
      JSON.stringify(raw),
      startsAt.getTime(),
      normalizeEventStatus(raw.status),
      Date.now()
    )
    .run();
};

export const synchronizeSportsCatalog = async (
  workerEnv: Env
): Promise<void> => {
  const sportNames = new Map(
    leagues.map((league) => [league[2], league[2]] as const)
  );
  for (const [slug, name] of sportNames) {
    await workerEnv.DB.prepare(
      `INSERT INTO sports (id, name, slug, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`
    )
      .bind(
        `sport:${slug}`,
        name[0]?.toUpperCase() + name.slice(1),
        slug,
        Date.now()
      )
      .run();
  }
  for (const [slug, name, sport] of leagues) {
    await workerEnv.DB.prepare(
      `INSERT INTO leagues (id, name, provider, provider_key, slug, sport_id, updated_at)
       VALUES (?, ?, 'sportradar', ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET name = excluded.name,
         provider_key = excluded.provider_key, updated_at = excluded.updated_at`
    )
      .bind(`league:${slug}`, name, slug, slug, `sport:${sport}`, Date.now())
      .run();
  }
  for (const [slug, name] of Object.entries(marketNames)) {
    const isTeamMarket = slug === "team_moneyline" || slug === "team_spread";
    const isGameMarket = slug === "game_total";
    let subjectType = "player";
    if (isTeamMarket) {
      subjectType = "team";
    } else if (isGameMarket) {
      subjectType = "game";
    }
    await workerEnv.DB.prepare(
      `INSERT INTO markets (id, name, slug, subject_type, updated_at, value_type)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`
    )
      .bind(
        `market:${slug}`,
        name,
        slug,
        subjectType,
        Date.now(),
        slug === "team_moneyline" ? "moneyline" : "numeric"
      )
      .run();
  }
  const dates = [new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000)];
  for (const [leagueSlug, , sportSlug] of leagues) {
    const playbook = playbooks[leagueSlug];
    if (!playbook) {
      continue;
    }
    const paths = new Set(dates.map((date) => playbook.path(date)));
    for (const path of paths) {
      const pendingPaths = [path];
      for (const pendingPath of pendingPaths) {
        const url = new URL(pendingPath, "https://api.sportradar.com/");
        url.searchParams.set("api_key", workerEnv.SPORTRADAR_API_KEY);
        const response = await fetch(url, {
          headers: {
            accept: "application/json",
            "user-agent": "ParlayPal/2.0",
          },
        });
        if (!response.ok) {
          workerEnv.ANALYTICS.writeDataPoint({
            blobs: ["sportradar.schedule_failed", leagueSlug],
            doubles: [response.status],
            indexes: [leagueSlug],
          });
          continue;
        }
        const payload = (await response.json()) as Record<string, unknown>;
        pendingPaths.push(
          ...(playbook.followupPaths?.(payload, new Date()) ?? [])
        );
        for (const raw of playbook.rows(payload)) {
          await upsertScheduleEvent(raw, leagueSlug, sportSlug, workerEnv);
        }
      }
    }
  }
};
