import type { ExtractionResult } from "@ppal/contracts/uploads";

import { escapeLikePattern } from "../lib/database";

type ExtractedLeg = ExtractionResult["legs"][number];
type ResolverStatus = "ambiguous" | "not_found" | "resolved" | "unsupported";

export interface CatalogResolution {
  leagueId: string | null;
  marketId: string | null;
  participantId: string | null;
  resolverStatus: ResolverStatus;
  sportId: string | null;
  sportsEventId: string | null;
}

interface MarketRow {
  id: string;
  sport_id: string | null;
  subject_type: "game" | "player" | "team";
}

interface ParticipantCandidate {
  id: string;
  league_id: string | null;
  name: string;
  short_name: string | null;
}

interface EventCandidate {
  away_name: string | null;
  away_short_name: string | null;
  away_participant_id: string | null;
  home_name: string | null;
  home_short_name: string | null;
  home_participant_id: string | null;
  id: string;
  league_id: string;
  sport_id: string;
  starts_at: number;
}

const normalizeText = (value: string): string =>
  value
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036F]/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();

const textTokens = (value: string): string[] =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);

const scoreParticipant = (
  subjectName: string,
  candidate: ParticipantCandidate
): number => {
  const subject = normalizeText(subjectName);
  const candidateName = normalizeText(candidate.name);
  const candidateShortName = candidate.short_name
    ? normalizeText(candidate.short_name)
    : "";
  if (
    subject === candidateName ||
    (candidateShortName !== "" && subject === candidateShortName)
  ) {
    return 100;
  }

  const subjectTokens = textTokens(subjectName);
  const shortTokens = textTokens(candidate.short_name ?? "");
  const subjectTokenSet = new Set(subjectTokens);

  if (
    shortTokens.length > 0 &&
    shortTokens.every((token) => subjectTokenSet.has(token))
  ) {
    return 95;
  }

  const nameTokens = textTokens(candidate.name);
  const nameTokenSet = new Set(nameTokens);

  if (
    subjectTokens.length > 0 &&
    subjectTokens.every((token) => nameTokenSet.has(token))
  ) {
    return 95;
  }

  const sharedNameTokens = nameTokens.filter((token) =>
    subjectTokenSet.has(token)
  ).length;
  if (nameTokens.length > 0 && sharedNameTokens === nameTokens.length) {
    return 90;
  }

  return nameTokens.length > 0
    ? (sharedNameTokens / nameTokens.length) * 60
    : 0;
};

const selectParticipant = (
  subjectName: string,
  candidates: ParticipantCandidate[]
): { ambiguous: boolean; candidate: ParticipantCandidate | null } => {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreParticipant(subjectName, candidate),
    }))
    .filter(({ score }) => score >= 90)
    .toSorted((left, right) => right.score - left.score);
  const [best, second] = scored;
  if (!best) {
    return { ambiguous: false, candidate: null };
  }
  if (second && second.score === best.score) {
    return { ambiguous: true, candidate: null };
  }
  return { ambiguous: false, candidate: best.candidate };
};

const scoreEvent = (
  event: EventCandidate,
  eventHint: string | null
): number => {
  if (!eventHint) {
    return 0;
  }
  const hintTokens = new Set(textTokens(eventHint));
  const names = [
    event.home_name,
    event.home_short_name,
    event.away_name,
    event.away_short_name,
  ].filter((name): name is string => Boolean(name));
  let score = 0;
  for (const name of names) {
    const nameTokens = textTokens(name);
    score += nameTokens.filter((token) => hintTokens.has(token)).length;
  }
  return score;
};

const normalizeMarketSlug = (market: string): string => {
  const normalized = market.toLowerCase();
  if (normalized === "moneyline") {
    return "team_moneyline";
  }
  if (normalized === "spread") {
    return "team_spread";
  }
  return normalized;
};

const resolveMarket = async (
  db: D1Database,
  leg: ExtractedLeg
): Promise<MarketRow | null> => {
  const targetSlug = normalizeMarketSlug(leg.market);
  return await db
    .prepare(
      `SELECT id, sport_id, subject_type FROM markets
       WHERE lower(slug) = lower(?) OR lower(name) = lower(?) OR lower(slug) = lower(?) LIMIT 1`
    )
    .bind(leg.market, leg.market, targetSlug)
    .first<MarketRow>();
};

const resolveParticipant = async ({
  db,
  leagueId,
  leg,
  sportId,
}: {
  db: D1Database;
  leagueId: string | null;
  leg: ExtractedLeg;
  sportId: string | null;
}): Promise<{
  ambiguous: boolean;
  participant: ParticipantCandidate | null;
}> => {
  const tokens = textTokens(leg.subjectName).toSorted(
    (left, right) => right.length - left.length
  );
  const searchToken = tokens[0] ?? normalizeText(leg.subjectName);
  const pattern = `%${escapeLikePattern(searchToken)}%`;
  const candidates = await db
    .prepare(
      `SELECT p.id, p.league_id, p.name, p.short_name
       FROM participants p
       WHERE p.type = ?
         AND (? IS NULL OR p.sport_id = ?)
         AND (? IS NULL OR p.league_id = ? OR p.league_id IS NULL)
         AND (lower(p.name) LIKE ? ESCAPE '\\'
           OR lower(p.short_name) LIKE ? ESCAPE '\\')
       ORDER BY p.name LIMIT 30`
    )
    .bind(
      leg.subjectType,
      sportId,
      sportId,
      leagueId,
      leagueId,
      pattern,
      pattern
    )
    .all<ParticipantCandidate>();
  const selected = selectParticipant(leg.subjectName, candidates.results);
  return {
    ambiguous: selected.ambiguous,
    participant: selected.candidate,
  };
};

const resolveEvent = async ({
  db,
  leagueId,
  participantId,
  eventHint,
}: {
  db: D1Database;
  leagueId: string | null;
  participantId: string;
  eventHint: string | null;
}): Promise<EventCandidate | null> => {
  const now = Date.now();
  const events = await db
    .prepare(
      `SELECT e.away_participant_id, away.name AS away_name,
          away.short_name AS away_short_name, e.home_participant_id,
          home.name AS home_name, home.short_name AS home_short_name,
          e.id, e.league_id, l.sport_id, e.starts_at
       FROM sports_events e
       JOIN leagues l ON l.id = e.league_id
       LEFT JOIN participants home ON home.id = e.home_participant_id
       LEFT JOIN participants away ON away.id = e.away_participant_id
       WHERE (e.home_participant_id = ? OR e.away_participant_id = ?)
         AND (? IS NULL OR e.league_id = ?)
         AND e.status != 'cancelled'
       ORDER BY abs(e.starts_at - ?) LIMIT 20`
    )
    .bind(participantId, participantId, leagueId, leagueId, now)
    .all<EventCandidate>();
  const ranked = events.results
    .map((event) => ({
      event,
      hintScore: scoreEvent(event, eventHint),
      timeDistance: Math.abs(event.starts_at - now),
    }))
    .toSorted(
      (left, right) =>
        right.hintScore - left.hintScore ||
        left.timeDistance - right.timeDistance
    );
  return ranked[0]?.event ?? null;
};

const resolveLeague = async (
  db: D1Database,
  leagueName: string | null
): Promise<{ id: string; sport_id: string } | null> => {
  if (!leagueName) {
    return null;
  }
  return await db
    .prepare(
      `SELECT id, sport_id FROM leagues
       WHERE lower(slug) = lower(?) OR lower(name) = lower(?) LIMIT 1`
    )
    .bind(leagueName, leagueName)
    .first<{ id: string; sport_id: string }>();
};

const resolveParticipantLeg = async ({
  db,
  league,
  leg,
  market,
}: {
  db: D1Database;
  league: { id: string; sport_id: string } | null;
  leg: ExtractedLeg;
  market: MarketRow;
}): Promise<CatalogResolution> => {
  const leagueId = league?.id ?? null;
  const sportId = league?.sport_id ?? market.sport_id;

  const participantResult = await resolveParticipant({
    db,
    leagueId,
    leg,
    sportId,
  });

  if (participantResult.ambiguous) {
    return {
      leagueId,
      marketId: market.id,
      participantId: null,
      resolverStatus: "ambiguous",
      sportId,
      sportsEventId: null,
    };
  }

  const { participant } = participantResult;
  if (!participant) {
    return {
      leagueId,
      marketId: market.id,
      participantId: null,
      resolverStatus: "not_found",
      sportId,
      sportsEventId: null,
    };
  }

  const eventLeagueId = leagueId ?? participant.league_id;
  const event = await resolveEvent({
    db,
    eventHint: leg.eventHint,
    leagueId: eventLeagueId,
    participantId: participant.id,
  });

  if (!event) {
    return {
      leagueId: participant.league_id ?? leagueId,
      marketId: market.id,
      participantId: participant.id,
      resolverStatus: "not_found",
      sportId,
      sportsEventId: null,
    };
  }

  return {
    leagueId: event.league_id,
    marketId: market.id,
    participantId: participant.id,
    resolverStatus: "resolved",
    sportId: event.sport_id,
    sportsEventId: event.id,
  };
};

export const resolveExtractedLeg = async (
  db: D1Database,
  leg: ExtractedLeg
): Promise<CatalogResolution> => {
  const market = await resolveMarket(db, leg);
  if (!market || market.subject_type !== leg.subjectType) {
    return {
      leagueId: null,
      marketId: market ? market.id : null,
      participantId: null,
      resolverStatus: "unsupported",
      sportId: market ? market.sport_id : null,
      sportsEventId: null,
    };
  }

  if (leg.subjectType === "game") {
    return {
      leagueId: null,
      marketId: market.id,
      participantId: null,
      resolverStatus: "ambiguous",
      sportId: market.sport_id,
      sportsEventId: null,
    };
  }

  const league = await resolveLeague(db, leg.league);
  return await resolveParticipantLeg({ db, league, leg, market });
};
