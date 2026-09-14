import { marketDefinitions } from "@ppal/contracts/markets";
import type {
  NotificationIntervalMinutes,
  TicketLegStatus,
} from "@ppal/contracts/tickets";

export interface ProgressLeg {
  awayName: string | null;
  awayScore: number | null;
  currentValue: number | null;
  homeName: string | null;
  homeScore: number | null;
  id: string;
  lastNotifiedSnapshot: string | null;
  marketSlug: string;
  status: TicketLegStatus;
  subjectName: string;
  targetValue: number | null;
}

export interface ProgressLine {
  legId: string;
  snapshot: string;
  text: string;
}

const numberText = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const marketName = (slug: string): string => {
  const definition = marketDefinitions[slug as keyof typeof marketDefinitions];
  return definition?.name.replace(/^Player /u, "") ?? slug.replaceAll("_", " ");
};

export const pollingDelayMs = (interval: NotificationIntervalMinutes): number =>
  interval * 60_000;

export const firstPregamePollAt = ({
  interval,
  now,
  startsAt,
}: {
  interval: NotificationIntervalMinutes;
  now: number;
  startsAt: number;
}): number => Math.max(now, startsAt - pollingDelayMs(interval));

export const isProgressNotificationDue = ({
  interval,
  lastNotifiedAt,
  now,
}: {
  interval: NotificationIntervalMinutes;
  lastNotifiedAt: number | null;
  now: number;
}): boolean =>
  lastNotifiedAt === null || now - lastNotifiedAt >= pollingDelayMs(interval);

export const buildProgressLine = (leg: ProgressLeg): ProgressLine | null => {
  if (leg.marketSlug === "team_moneyline") {
    if (leg.awayScore === null || leg.homeScore === null) {
      return null;
    }
    const snapshot = `${leg.awayScore}:${leg.homeScore}:${leg.status}`;
    if (snapshot === leg.lastNotifiedSnapshot) {
      return null;
    }
    return {
      legId: leg.id,
      snapshot,
      text: `${leg.subjectName} moneyline — ${leg.awayName ?? "Away"} ${leg.awayScore}, ${leg.homeName ?? "Home"} ${leg.homeScore}`,
    };
  }
  if (leg.currentValue === null) {
    return null;
  }
  const snapshot = `${leg.currentValue}:${leg.status}`;
  if (snapshot === leg.lastNotifiedSnapshot) {
    return null;
  }
  const progress =
    leg.targetValue === null
      ? numberText(leg.currentValue)
      : `${numberText(leg.currentValue)}/${numberText(leg.targetValue)}`;
  return {
    legId: leg.id,
    snapshot,
    text: `${leg.subjectName} ${marketName(leg.marketSlug)} ${progress}`,
  };
};
