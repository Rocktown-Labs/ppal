/* oxlint-disable no-await-in-loop -- Sequential provider calls protect the upstream rate limit. */

import { marketDefinitions } from "@ppal/contracts/markets";

import { getDb } from "../lib/database";
import {
  acquireSportsApiBudget,
  SPORTSAPI_PRO_BASE_URL,
  SPORTSAPI_PRO_PROVIDER,
  syncSportsApiQuotaHeaders,
} from "./sports";

const SCHEDULE_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

const STATIC_SPORTS = [
  ["basketball", "Basketball"],
  ["football", "Football"],
  ["baseball", "Baseball"],
  ["hockey", "Hockey"],
  ["soccer", "Soccer"],
  ["mma", "MMA"],
  ["tennis", "Tennis"],
  ["racing", "Racing"],
  ["golf", "Golf"],
] as const;

const STATIC_LEAGUES = [
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

const SPORTSAPI_SPORT_MAP: Record<string, string> = {
  baseball: "baseball",
  basketball: "basketball",
  football: "american-football",
  golf: "golf",
  hockey: "hockey",
  mma: "mma",
  racing: "motorsport",
  soccer: "football",
  tennis: "tennis",
};

const HINT_TO_SPORT_SLUG: readonly [RegExp, string][] = [
  [
    /\b(?:nba|wnba|ncaa\w*\s*basketball|ncaamb|ncaawb|euroleague|basketball)\b/iu,
    "basketball",
  ],
  [
    /\b(?:nfl|ncaaf|ncaafb|cfb|cfl|american\s*football|football)\b/iu,
    "football",
  ],
  [/\b(?:mlb|baseball|kbo|npb)\b/iu, "baseball"],
  [/\b(?:nhl|khl|hockey|ice\s*hockey)\b/iu, "hockey"],
  [
    /\b(?:epl|premier\s*league|mls|la\s*liga|serie\s*a|bundesliga|champions\s*league|soccer|fifa)\b/iu,
    "soccer",
  ],
  [/\b(?:ufc|mma|bellator|pfl)\b/iu, "mma"],
  [
    /\b(?:atp|wta|tennis|wimbledon|us\s*open|french\s*open|australian\s*open)\b/iu,
    "tennis",
  ],
  [
    /\b(?:f1|formula\s*1|nascar|motogp|indycar|racing|motorsport)\b/iu,
    "racing",
  ],
  [/\b(?:pga|liv|golf|masters)\b/iu, "golf"],
];

const marketNames = Object.fromEntries(
  Object.entries(marketDefinitions).map(([slug, definition]) => [
    slug,
    definition.name,
  ])
);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asRecords = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const rec = asRecord(item);
        return rec ? [rec] : [];
      })
    : [];

export const resolveSportSlugFromHint = (
  sportHint: string | null | undefined,
  leagueHint?: string | null
): string | null => {
  const combined = `${sportHint ?? ""} ${leagueHint ?? ""}`.trim();
  if (!combined) {
    return null;
  }
  const lowered = combined.toLowerCase();
  if (lowered in SPORTSAPI_SPORT_MAP) {
    return lowered;
  }
  for (const [pattern, slug] of HINT_TO_SPORT_SLUG) {
    if (pattern.test(combined)) {
      return slug;
    }
  }
  return null;
};

export const toSportsApiSportPath = (sportSlug: string): string | null =>
  SPORTSAPI_SPORT_MAP[sportSlug.toLowerCase()] ?? null;

const normalizeScheduleEventStatus = (
  raw: Record<string, unknown>
): "cancelled" | "final" | "live" | "postponed" | "scheduled" => {
  const statusObj = asRecord(raw.status);
  const rawStatus = String(statusObj?.type ?? raw.status ?? "").toLowerCase();
  if (
    rawStatus === "inprogress" ||
    rawStatus === "live" ||
    rawStatus === "pause"
  ) {
    return "live";
  }
  if (
    rawStatus === "finished" ||
    rawStatus === "ended" ||
    rawStatus === "closed"
  ) {
    return "final";
  }
  if (rawStatus === "postponed") {
    return "postponed";
  }
  if (rawStatus === "canceled" || rawStatus === "cancelled") {
    return "cancelled";
  }
  return "scheduled";
};

const extractStartTimestampMs = (
  raw: Record<string, unknown>
): number | null => {
  const startTs = raw.startTimestamp;
  if (typeof startTs === "number" && Number.isFinite(startTs)) {
    return startTs > 1_000_000_000_000 ? startTs : startTs * 1000;
  }
  const iso = raw.startTime ?? raw.scheduled;
  if (typeof iso === "string") {
    const parsed = new Date(iso).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "_")
    .replaceAll(/^_+|_+$/gu, "")
    .slice(0, 64) || "league";

const upsertTeamParticipant = async ({
  leagueId,
  name,
  providerId,
  sportId,
  workerEnv,
}: {
  leagueId: string;
  name: string;
  providerId: string;
  sportId: string;
  workerEnv: Env;
}): Promise<string> => {
  const id = `team:${SPORTSAPI_PRO_PROVIDER}:${providerId}`;
  await getDb(workerEnv)
    .prepare(
      `INSERT INTO participants (
        id, league_id, name, provider, provider_participant_id, short_name, sport_id, type, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'team', ?)
      ON CONFLICT(provider, provider_participant_id) DO UPDATE SET
        league_id = excluded.league_id,
        name = excluded.name,
        short_name = excluded.short_name,
        sport_id = excluded.sport_id,
        updated_at = excluded.updated_at`
    )
    .bind(
      id,
      leagueId,
      name,
      SPORTSAPI_PRO_PROVIDER,
      providerId,
      name,
      sportId,
      Date.now()
    )
    .run();
  return id;
};

const extractTeamDescriptor = (
  rawTeam: unknown,
  rawTeamId: unknown
): { name: string; providerId: string } | null => {
  const teamObj = asRecord(rawTeam);
  const name =
    typeof rawTeam === "string"
      ? rawTeam.trim()
      : String(teamObj?.name ?? "").trim();
  if (!name) {
    return null;
  }
  const providerId = String(rawTeamId ?? teamObj?.id ?? slugify(name));
  return providerId ? { name, providerId } : null;
};

const upsertScheduleEvent = async (
  raw: Record<string, unknown>,
  sportSlug: string,
  workerEnv: Env
): Promise<void> => {
  const providerEventId =
    raw.id === undefined || raw.id === null ? null : String(raw.id);
  const startsAtMs = extractStartTimestampMs(raw);
  if (!(providerEventId && startsAtMs)) {
    return;
  }

  const sportId = `sport:${sportSlug}`;
  const tournamentObj = asRecord(raw.tournament);
  const tournamentName = String(
    tournamentObj?.name ?? raw.tournament ?? sportSlug.toUpperCase()
  ).trim();
  const tournamentProviderKey = String(
    tournamentObj?.id ?? raw.tournamentId ?? slugify(tournamentName)
  );
  const leagueSlug = `${sportSlug}_${slugify(tournamentName)}`;
  const leagueId = `league:${SPORTSAPI_PRO_PROVIDER}:${sportSlug}:${tournamentProviderKey}`;
  const now = Date.now();

  await getDb(workerEnv)
    .prepare(
      `INSERT INTO leagues (id, name, provider, provider_key, slug, sport_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(provider, provider_key) DO UPDATE SET
         name = excluded.name,
         updated_at = excluded.updated_at`
    )
    .bind(
      leagueId,
      tournamentName,
      SPORTSAPI_PRO_PROVIDER,
      `${sportSlug}:${tournamentProviderKey}`,
      leagueSlug,
      sportId,
      now
    )
    .run();

  const homeTeam = extractTeamDescriptor(raw.homeTeam, raw.homeTeamId);
  const awayTeam = extractTeamDescriptor(raw.awayTeam, raw.awayTeamId);
  const homeId = homeTeam
    ? await upsertTeamParticipant({
        leagueId,
        name: homeTeam.name,
        providerId: `${sportSlug}:${homeTeam.providerId}`,
        sportId,
        workerEnv,
      })
    : null;
  const awayId = awayTeam
    ? await upsertTeamParticipant({
        leagueId,
        name: awayTeam.name,
        providerId: `${sportSlug}:${awayTeam.providerId}`,
        sportId,
        workerEnv,
      })
    : null;

  await getDb(workerEnv)
    .prepare(
      `INSERT INTO sports_events (
        away_participant_id, home_participant_id, id, league_id, next_poll_at,
        provider, provider_event_id, provider_payload, starts_at, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, provider_event_id) DO UPDATE SET
        away_participant_id = excluded.away_participant_id,
        home_participant_id = excluded.home_participant_id,
        league_id = excluded.league_id,
        next_poll_at = LEAST(COALESCE(sports_events.next_poll_at, excluded.next_poll_at), excluded.next_poll_at),
        provider_payload = excluded.provider_payload,
        starts_at = excluded.starts_at,
        status = CASE
          WHEN sports_events.status IN ('final', 'cancelled') THEN sports_events.status
          ELSE excluded.status
        END,
        updated_at = excluded.updated_at`
    )
    .bind(
      awayId,
      homeId,
      `event:${SPORTSAPI_PRO_PROVIDER}:${sportSlug}:${providerEventId}`,
      leagueId,
      startsAtMs - 5 * 60 * 1000,
      SPORTSAPI_PRO_PROVIDER,
      providerEventId,
      JSON.stringify(raw),
      startsAtMs,
      normalizeScheduleEventStatus(raw),
      now
    )
    .run();
};

/**
 * Seeds static sports, default leagues, and supported betting markets locally.
 * Makes ZERO upstream HTTP calls.
 */
export const ensureStaticSportsCatalog = async (
  workerEnv: Env
): Promise<void> => {
  const now = Date.now();
  const db = getDb(workerEnv);

  for (const [slug, name] of STATIC_SPORTS) {
    await db
      .prepare(
        `INSERT INTO sports (id, name, slug, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`
      )
      .bind(`sport:${slug}`, name, slug, now)
      .run();
  }

  for (const [slug, name, sport] of STATIC_LEAGUES) {
    await db
      .prepare(
        `INSERT INTO leagues (id, name, provider, provider_key, slug, sport_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET name = excluded.name,
           provider = excluded.provider, provider_key = excluded.provider_key,
           updated_at = excluded.updated_at`
      )
      .bind(
        `league:${slug}`,
        name,
        SPORTSAPI_PRO_PROVIDER,
        slug,
        slug,
        `sport:${sport}`,
        now
      )
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
    await db
      .prepare(
        `INSERT INTO markets (id, name, slug, subject_type, updated_at, value_type)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`
      )
      .bind(
        `market:${slug}`,
        name,
        slug,
        subjectType,
        now,
        slug === "team_moneyline" ? "moneyline" : "numeric"
      )
      .run();
  }
};

/**
 * Reactive, demand-driven schedule hydration for ONE sport and date.
 * Cached in `provider_schedule_syncs` for 3 hours so repeated uploads for the
 * same sport/day cost 0 upstream API calls.
 */
export const ensureSportScheduleHydrated = async ({
  date,
  sportSlug,
  workerEnv,
}: {
  date?: string;
  sportSlug: string;
  workerEnv: Env;
}): Promise<{ hydrated: boolean; eventCount: number }> => {
  const apiKey = workerEnv.SPORTSAPI_PRO_API_KEY?.trim();
  const apiSport = toSportsApiSportPath(sportSlug);
  if (!(apiKey && apiSport)) {
    return { eventCount: 0, hydrated: false };
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const scheduleDate =
    date && /^\d{4}-\d{2}-\d{2}$/u.test(date) ? date : todayIso;
  const now = Date.now();
  const db = getDb(workerEnv);

  const cached = await db
    .prepare(
      `SELECT synced_at FROM provider_schedule_syncs
       WHERE provider = ? AND sport_slug = ? AND schedule_date = ?`
    )
    .bind(SPORTSAPI_PRO_PROVIDER, sportSlug, scheduleDate)
    .first<{ synced_at: number }>();
  if (cached && now - cached.synced_at < SCHEDULE_CACHE_TTL_MS) {
    return { eventCount: 0, hydrated: false };
  }

  const budget = await acquireSportsApiBudget(workerEnv);
  if (!budget.granted) {
    workerEnv.ANALYTICS.writeDataPoint({
      blobs: ["sportsapipro.schedule_deferred", sportSlug],
      doubles: [budget.retryAfterMs, budget.remaining],
      indexes: [sportSlug],
    });
    return { eventCount: 0, hydrated: false };
  }

  const endpointPath =
    scheduleDate === todayIso
      ? `/v2/${apiSport}/api/today`
      : `/v2/${apiSport}/api/schedule/${scheduleDate}`;
  const url = new URL(endpointPath, SPORTSAPI_PRO_BASE_URL);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "ParlayPal/2.0",
        "x-api-key": apiKey,
      },
    });
    await syncSportsApiQuotaHeaders(response.headers, workerEnv);
    if (!response.ok) {
      workerEnv.ANALYTICS.writeDataPoint({
        blobs: ["sportsapipro.schedule_failed", sportSlug],
        doubles: [response.status],
        indexes: [sportSlug],
      });
      return { eventCount: 0, hydrated: false };
    }
    const payload = (await response.json()) as Record<string, unknown>;
    const events = asRecords(
      payload.events ?? payload.matches ?? payload.games ?? payload.data
    );
    await ensureStaticSportsCatalog(workerEnv);
    for (const raw of events) {
      await upsertScheduleEvent(raw, sportSlug, workerEnv);
    }
    await db
      .prepare(
        `INSERT INTO provider_schedule_syncs (id, provider, schedule_date, sport_slug, synced_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, sport_slug, schedule_date) DO UPDATE SET
           synced_at = excluded.synced_at,
           updated_at = excluded.updated_at`
      )
      .bind(
        `sync:${SPORTSAPI_PRO_PROVIDER}:${sportSlug}:${scheduleDate}`,
        SPORTSAPI_PRO_PROVIDER,
        scheduleDate,
        sportSlug,
        now,
        now
      )
      .run();
    return { eventCount: events.length, hydrated: true };
  } catch {
    workerEnv.ANALYTICS.writeDataPoint({
      blobs: ["sportsapipro.schedule_error", sportSlug],
      doubles: [1],
      indexes: [sportSlug],
    });
    return { eventCount: 0, hydrated: false };
  }
};

/**
 * Legacy entrypoint kept for cron/bootstrap callers — seeds static catalog only
 * without making any eager upstream API calls.
 */
export const synchronizeSportsCatalog = ensureStaticSportsCatalog;
