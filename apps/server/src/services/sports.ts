/* oxlint-disable no-await-in-loop -- Leg updates are serialized per event for deterministic settlement. */

import { marketDefinitions } from "@ppal/contracts/markets";
import { sportsPollQueueMessageSchema } from "@ppal/contracts/queues";
import type {
  SportsEventStatus,
  TicketLegOperator,
  TicketLegStatus,
  TicketStatus,
} from "@ppal/contracts/tickets";
import { evaluateLeg } from "@ppal/domain/tracking/evaluate-leg";
import { evaluateTicket } from "@ppal/domain/tracking/evaluate-ticket";

import { refreshHistoricalBatch } from "./historical-imports";
import { publishNotification } from "./notifications";

interface EventRow {
  away_participant_id: string | null;
  away_score: number | null;
  home_participant_id: string | null;
  home_score: number | null;
  id: string;
  league_id: string;
  league_slug: string;
  provider_event_id: string;
  starts_at: number;
  status: SportsEventStatus;
  sport_id: string;
}

interface TrackingRow {
  current_value: number | null;
  historical_import_batch_id: string | null;
  ingestion_mode: "historical" | "single";
  leg_id: string;
  leg_status: TicketLegStatus;
  lost_at: number | null;
  market_id: string;
  market_components: string | null;
  market_slug: string;
  operator: TicketLegOperator;
  participant_id: string | null;
  provider_participant_id: string | null;
  settled_at: number | null;
  target_value: number | null;
  ticket_id: string;
  ticket_status: TicketStatus;
  user_id: string;
  won_at: number | null;
}

const summaryPaths: Record<string, (event: EventRow) => string> = {
  f1: () => "formula1/trial/v2/en/sport_events",
  global_american_football: () => "americanfootball/trial/v2/en/sport_events",
  global_baseball: () => "baseball/trial/v2/en/sport_events",
  global_basketball: () => "basketball/trial/v2/en/sport_events",
  global_ice_hockey: () => "icehockey/trial/v2/en/sport_events",
  mlb: () => "mlb/trial/v8/en/games",
  nascar: () => "nascar-ot3/mc/races",
  nba: () => "nba/trial/v8/en/games",
  ncaafb: () => "ncaafb/trial/v7/en/games",
  ncaamb: () => "ncaamb/trial/v8/en/games",
  ncaawb: () => "ncaawb/trial/v8/en/games",
  nfl: () => "nfl/official/trial/v7/en/games",
  nhl: () => "nhl/trial/v7/en/games",
  pga: () => "golf/pga/trial/v3/en",
  soccer: () => "soccer-extended/trial/v4/en/sport_events",
  tennis: () => "tennis/trial/v3/en/sport_events",
  ufc: () => "mma/trial/v2/en/sport_events",
  wnba: () => "wnba/trial/v8/en/games",
};

const boxscoreLeagues = new Set([
  "ncaafb",
  "ncaamb",
  "ncaawb",
  "nfl",
  "nhl",
  "wnba",
]);

const marketStatKeys = Object.fromEntries(
  Object.entries(marketDefinitions).map(([slug, definition]) => [
    slug,
    [...definition.statKeys],
  ])
) as Record<string, string[]>;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const collectRecords = (
  value: unknown,
  records: Record<string, unknown>[]
): void => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRecords(item, records);
    }
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  if (
    (typeof record.id === "string" || typeof record.sr_id === "string") &&
    (record.statistics || record.result || typeof record.position === "number")
  ) {
    records.push(record);
  }
  for (const child of Object.values(record)) {
    collectRecords(child, records);
  }
};

export const findNumber = (
  value: unknown,
  keys: readonly string[]
): number | null => {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  for (const key of keys) {
    if (typeof record[key] === "number") {
      return record[key];
    }
  }
  for (const child of Object.values(record)) {
    const found = findNumber(child, keys);
    if (found !== null) {
      return found;
    }
  }
  return null;
};

export const normalizeStatus = (
  summary: Record<string, unknown>,
  previous: SportsEventStatus
): SportsEventStatus => {
  const game = asRecord(summary.game);
  const eventStatus = asRecord(summary.sport_event_status);
  const raw = String(
    game?.status ??
      eventStatus?.status ??
      eventStatus?.match_status ??
      summary.status ??
      ""
  ).toLowerCase();
  if (["inprogress", "live", "started"].includes(raw)) {
    return "live";
  }
  if (["closed", "complete", "final", "ended"].includes(raw)) {
    return "final";
  }
  if (raw === "postponed" || raw === "cancelled") {
    return raw;
  }
  return previous;
};

export const summaryScores = (
  summary: Record<string, unknown>,
  event: EventRow
): { away: number | null; home: number | null } => {
  const game = asRecord(summary.game);
  const home = asRecord(game?.home ?? summary.home);
  const away = asRecord(game?.away ?? summary.away);
  const eventStatus = asRecord(summary.sport_event_status);
  return {
    away:
      findNumber(away, ["points", "runs", "score"]) ??
      (typeof eventStatus?.away_score === "number"
        ? eventStatus.away_score
        : event.away_score),
    home:
      findNumber(home, ["points", "runs", "score"]) ??
      (typeof eventStatus?.home_score === "number"
        ? eventStatus.home_score
        : event.home_score),
  };
};

const sha256Hex = async (value: string): Promise<string> => {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};

const participantName = (record: Record<string, unknown>): string => {
  const direct = record.full_name ?? record.name ?? record.display_name;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  const first = String(record.first_name ?? record.preferred_name ?? "").trim();
  const last = String(record.last_name ?? "").trim();
  return `${first} ${last}`.trim();
};

const upsertObservedParticipants = async (
  event: EventRow,
  records: Record<string, unknown>[],
  workerEnv: Env
): Promise<void> => {
  const unique = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    const providerId = String(record.id ?? record.sr_id ?? "");
    if (providerId && participantName(record)) {
      unique.set(providerId, record);
    }
  }
  const values = [...unique.entries()];
  for (let start = 0; start < values.length; start += 100) {
    const statements = values
      .slice(start, start + 100)
      .map(([providerId, record]) => {
        const name = participantName(record);
        return workerEnv.DB.prepare(
          `INSERT INTO participants (id, league_id, name, provider, provider_participant_id, short_name, sport_id, type, updated_at)
         VALUES (?, ?, ?, 'sportradar', ?, ?, ?, 'player', ?)
         ON CONFLICT(provider, provider_participant_id) DO UPDATE SET name = excluded.name,
           short_name = excluded.short_name, league_id = excluded.league_id,
           sport_id = excluded.sport_id, updated_at = excluded.updated_at`
        ).bind(
          `participant:${providerId}`,
          event.league_id,
          name,
          providerId,
          String(record.abbr_name ?? record.abbreviation ?? name),
          event.sport_id,
          Date.now()
        );
      });
    if (statements.length > 0) {
      await workerEnv.DB.batch(statements);
    }
  }
};

const fetchSummary = async (
  event: EventRow,
  apiKey: string
): Promise<{ payload: Record<string, unknown>; sequence: string }> => {
  const basePath = summaryPaths[event.league_slug];
  if (!basePath) {
    throw new Error(`Unsupported Sportradar league: ${event.league_slug}`);
  }
  const suffix = boxscoreLeagues.has(event.league_slug)
    ? "boxscore.json"
    : "summary.json";
  let requestPath = `${basePath(event)}/${encodeURIComponent(event.provider_event_id)}/${suffix}`;
  if (event.league_slug === "nascar") {
    requestPath = `nascar-ot3/mc/races/${encodeURIComponent(event.provider_event_id)}/results.json`;
  } else if (event.league_slug === "pga") {
    const year = new Date(event.starts_at).getUTCFullYear();
    requestPath = `golf/pga/trial/v3/en/${year}/tournaments/${encodeURIComponent(event.provider_event_id)}/leaderboard.json`;
  }
  const url = new URL(requestPath, "https://api.sportradar.com/");
  url.searchParams.set("api_key", apiKey);
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Sportradar request failed (${response.status})`);
  }
  return {
    payload: JSON.parse(text) as Record<string, unknown>,
    sequence: await sha256Hex(text),
  };
};

// The orchestration is intentionally linear: claim, observe, evaluate, settle.
// oxlint-disable-next-line complexity
export const processSportsMessage = async (
  body: unknown,
  workerEnv: Env
): Promise<void> => {
  const message = sportsPollQueueMessageSchema.parse(body);
  const event = await workerEnv.DB.prepare(
    `SELECT e.away_participant_id, e.away_score, e.home_participant_id,
      e.home_score, e.id, e.league_id, e.provider_event_id, e.starts_at, e.status,
      l.slug AS league_slug, l.sport_id FROM sports_events e
      JOIN leagues l ON l.id = e.league_id
      WHERE e.id = ? AND e.poll_lease_until = ?`
  )
    .bind(message.eventId, Number(message.leaseToken))
    .first<EventRow>();
  if (!event) {
    return;
  }
  const { payload, sequence } = await fetchSummary(
    event,
    workerEnv.SPORTRADAR_API_KEY
  );
  const status = normalizeStatus(payload, event.status);
  const scores = summaryScores(payload, event);
  let nextPollDelay: number | null = null;
  if (status === "live") {
    nextPollDelay = 30_000;
  } else if (status === "scheduled") {
    nextPollDelay = 300_000;
  }
  await workerEnv.DB.prepare(
    `UPDATE sports_events SET away_score = ?, home_score = ?, last_synced_at = ?,
      next_poll_at = ?, provider_payload = ?, status = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      scores.away,
      scores.home,
      Date.now(),
      nextPollDelay ? Date.now() + nextPollDelay : null,
      JSON.stringify(payload),
      status,
      Date.now(),
      event.id
    )
    .run();

  const tracked = await workerEnv.DB.prepare(
    `SELECT l.current_value, l.id AS leg_id, l.lost_at, l.operator,
      l.market_components, l.participant_id, l.settled_at, l.status AS leg_status, l.target_value,
      l.ticket_id, l.won_at, m.id AS market_id, m.slug AS market_slug,
      p.provider_participant_id, t.historical_import_batch_id, t.ingestion_mode,
      t.status AS ticket_status, t.user_id
     FROM tracking_subscriptions s
     JOIN ticket_legs l ON l.id = s.ticket_leg_id
     JOIN tickets t ON t.id = l.ticket_id
     JOIN markets m ON m.id = s.market_id
     LEFT JOIN participants p ON p.id = s.participant_id
     WHERE s.sports_event_id = ? AND s.status = 'active'`
  )
    .bind(event.id)
    .all<TrackingRow>();
  const playerRecords: Record<string, unknown>[] = [];
  collectRecords(payload, playerRecords);
  await upsertObservedParticipants(event, playerRecords, workerEnv);
  const affectedTickets = new Map<
    string,
    {
      historicalImportBatchId: string | null;
      ingestionMode: "historical" | "single";
      status: TicketStatus;
      userId: string;
    }
  >();
  for (const trackedLeg of tracked.results) {
    if (status === "cancelled") {
      const cancelledAt = Date.now();
      await workerEnv.DB.batch([
        workerEnv.DB.prepare(
          `UPDATE ticket_legs SET settled_at = ?, status = 'void', updated_at = ?, version = version + 1
           WHERE id = ? AND status IN ('pending', 'live', 'unresolved')`
        ).bind(cancelledAt, cancelledAt, trackedLeg.leg_id),
        workerEnv.DB.prepare(
          "UPDATE tracking_subscriptions SET status = 'completed', updated_at = ? WHERE ticket_leg_id = ?"
        ).bind(cancelledAt, trackedLeg.leg_id),
      ]);
      affectedTickets.set(trackedLeg.ticket_id, {
        historicalImportBatchId: trackedLeg.historical_import_batch_id,
        ingestionMode: trackedLeg.ingestion_mode,
        status: trackedLeg.ticket_status,
        userId: trackedLeg.user_id,
      });
      continue;
    }
    const player = playerRecords.find(
      (record) =>
        record.id === trackedLeg.provider_participant_id ||
        record.sr_id === trackedLeg.provider_participant_id
    );
    const components = trackedLeg.market_components
      ? (JSON.parse(trackedLeg.market_components) as string[])
      : [];
    let value: number | null = null;
    if (components.length > 0) {
      let sum = 0;
      let allFound = true;
      for (const component of components) {
        const componentValue = findNumber(
          player?.statistics ?? player,
          marketStatKeys[component] ?? []
        );
        if (componentValue === null) {
          allFound = false;
          break;
        }
        sum += componentValue;
      }
      value = allFound ? sum : null;
    } else {
      value = findNumber(
        player?.statistics ?? player,
        marketStatKeys[trackedLeg.market_slug] ?? []
      );
    }
    if (
      trackedLeg.market_slug === "team_moneyline" ||
      trackedLeg.market_slug === "team_spread"
    ) {
      value =
        trackedLeg.participant_id === event.home_participant_id
          ? scores.home
          : scores.away;
    } else if (trackedLeg.market_slug === "game_total") {
      value =
        scores.home === null || scores.away === null
          ? null
          : scores.home + scores.away;
    } else if (
      ["finish_position", "leaderboard_position"].includes(
        trackedLeg.market_slug
      )
    ) {
      value = findNumber(player, ["position"]);
    } else if (
      ["race_winner", "tournament_winner"].includes(trackedLeg.market_slug)
    ) {
      const position = findNumber(player, ["position"]);
      value = position === null ? null : Number(position === 1);
    }
    if (value === null) {
      if (status === "final") {
        throw new Error(
          `Final provider payload is missing ${trackedLeg.market_slug} for leg ${trackedLeg.leg_id}`
        );
      }
      continue;
    }
    const observationKey = `sportradar:${event.id}:${trackedLeg.participant_id}:${trackedLeg.market_id}:${sequence}`;
    await workerEnv.DB.prepare(
      `INSERT INTO stat_observations (
        idempotency_key, market_id, observed_at, participant_id, provider,
        provider_sequence, sports_event_id, value
      ) VALUES (?, ?, ?, ?, 'sportradar', ?, ?, ?)
      ON CONFLICT(idempotency_key) DO NOTHING`
    )
      .bind(
        observationKey,
        trackedLeg.market_id,
        Date.now(),
        trackedLeg.participant_id,
        sequence,
        event.id,
        value
      )
      .run();
    // Observations are shared and deduplicated, but every subscribed leg must
    // still be evaluated against the resulting value.
    const evaluation = evaluateLeg(
      {
        currentValue: trackedLeg.current_value,
        event: {
          awayParticipantId: event.away_participant_id,
          awayScore: scores.away,
          homeParticipantId: event.home_participant_id,
          homeScore: scores.home,
          status,
        },
        lostAt: trackedLeg.lost_at ? new Date(trackedLeg.lost_at) : null,
        operator: trackedLeg.operator,
        participantId: trackedLeg.participant_id,
        settledAt: trackedLeg.settled_at
          ? new Date(trackedLeg.settled_at)
          : null,
        status: trackedLeg.leg_status,
        targetValue: trackedLeg.target_value,
        wonAt: trackedLeg.won_at ? new Date(trackedLeg.won_at) : null,
      },
      value
    );
    await workerEnv.DB.prepare(
      `UPDATE ticket_legs SET current_value = ?, lost_at = ?, settled_at = ?,
        status = ?, updated_at = ?, version = version + 1, won_at = ? WHERE id = ?`
    )
      .bind(
        evaluation.currentValue,
        evaluation.lostAt?.getTime() ?? null,
        evaluation.settledAt?.getTime() ?? null,
        evaluation.status,
        Date.now(),
        evaluation.wonAt?.getTime() ?? null,
        trackedLeg.leg_id
      )
      .run();
    affectedTickets.set(trackedLeg.ticket_id, {
      historicalImportBatchId: trackedLeg.historical_import_batch_id,
      ingestionMode: trackedLeg.ingestion_mode,
      status: trackedLeg.ticket_status,
      userId: trackedLeg.user_id,
    });
    if (
      evaluation.changed &&
      (evaluation.status === "won" || evaluation.status === "lost")
    ) {
      await publishNotification({
        body: `A leg on your ticket is now ${evaluation.status}.`,
        milestoneKey: `${trackedLeg.leg_id}:${evaluation.status}:${sequence}`,
        ticketId: trackedLeg.ticket_id,
        title: `Leg ${evaluation.status}`,
        type: `leg.${evaluation.status}`,
        userId: trackedLeg.user_id,
        workerEnv,
      });
    }
  }

  for (const [ticketId, ticketState] of affectedTickets) {
    const legRows = await workerEnv.DB.prepare(
      "SELECT status FROM ticket_legs WHERE ticket_id = ?"
    )
      .bind(ticketId)
      .all<{ status: TicketLegStatus }>();
    const result = evaluateTicket({
      legStatuses: legRows.results.map(({ status: legStatus }) => legStatus),
      settledAt: null,
      status: ticketState.status,
    });
    if (!result.changed) {
      continue;
    }
    const providerVerified =
      ticketState.ingestionMode === "historical" &&
      (result.status === "won" ||
        result.status === "lost" ||
        result.status === "void");
    await workerEnv.DB.prepare(
      `UPDATE tickets SET result_source = CASE WHEN ? THEN 'historical_provider' ELSE result_source END,
       settled_at = ?, status = ?, updated_at = ?, verification_status = CASE WHEN ? THEN 'verified' ELSE verification_status END,
       verified_at = CASE WHEN ? THEN ? ELSE verified_at END, version = version + 1 WHERE id = ?`
    )
      .bind(
        Number(providerVerified),
        result.settledAt?.getTime() ?? null,
        result.status,
        Date.now(),
        Number(providerVerified),
        Number(providerVerified),
        providerVerified ? Date.now() : null,
        ticketId
      )
      .run();
    if (ticketState.historicalImportBatchId) {
      await refreshHistoricalBatch(
        workerEnv.DB,
        ticketState.historicalImportBatchId
      );
    }
    if (result.status === "won" || result.status === "lost") {
      await publishNotification({
        body: `Your ticket has settled as ${result.status}.`,
        milestoneKey: `${ticketId}:${result.status}:${sequence}`,
        ticketId,
        title: `Ticket ${result.status}`,
        type: `ticket.${result.status}`,
        userId: ticketState.userId,
        workerEnv,
      });
    }
  }
  await workerEnv.DB.prepare(
    "UPDATE sports_events SET poll_lease_until = NULL WHERE id = ? AND poll_lease_until = ?"
  )
    .bind(event.id, Number(message.leaseToken))
    .run();
};

export const enqueueDueSportsEvents = async (workerEnv: Env): Promise<void> => {
  const now = Date.now();
  const leaseUntil = now + 60_000;
  const due = await workerEnv.DB.prepare(
    `UPDATE sports_events SET poll_lease_until = ?, updated_at = ?
     WHERE id IN (
       SELECT id FROM sports_events
       WHERE status IN ('scheduled', 'live') AND next_poll_at <= ?
         AND (poll_lease_until IS NULL OR poll_lease_until < ?)
       ORDER BY next_poll_at LIMIT 100
     ) RETURNING id`
  )
    .bind(leaseUntil, now, now, now)
    .all<{ id: string }>();
  if (due.results.length === 0) {
    return;
  }
  await workerEnv.SPORTS_QUEUE.sendBatch(
    due.results.map(({ id }) => ({
      body: { eventId: id, leaseToken: String(leaseUntil) },
      contentType: "json" as const,
    }))
  );
};
