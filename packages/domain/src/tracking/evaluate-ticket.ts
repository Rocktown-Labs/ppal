import type { TicketLegStatus, TicketStatus } from "@ppal/contracts/tickets";

import type { TicketEvaluationInput, TicketEvaluationResult } from "./types";

const REVIEW_STATUSES = new Set<TicketStatus>(["draft", "needs_review"]);
const VOID_LEG_STATUSES = new Set<TicketLegStatus>(["void", "cancelled"]);

const countStatuses = (legStatuses: readonly TicketLegStatus[]) => {
  const counts = {
    live: 0,
    lost: 0,
    pending: 0,
    push: 0,
    void: 0,
    won: 0,
  };

  for (const status of legStatuses) {
    if (VOID_LEG_STATUSES.has(status)) {
      counts.void += 1;
    } else if (status in counts) {
      counts[status as keyof typeof counts] += 1;
    }
  }

  return counts;
};

const deriveTicketStatus = (input: TicketEvaluationInput): TicketStatus => {
  const { legStatuses, status } = input;
  if (REVIEW_STATUSES.has(status) || legStatuses.length === 0) {
    return status;
  }

  const counts = countStatuses(legStatuses);
  const totalLegs = legStatuses.length;

  if (counts.lost > 0) {
    return "lost";
  }

  const settledWithoutLoss = counts.won + counts.push + counts.void;
  if (counts.won > 0 && settledWithoutLoss === totalLegs) {
    return counts.push > 0 || counts.void > 0 ? "partially_void" : "won";
  }

  if (counts.push + counts.void === totalLegs) {
    return "push";
  }

  const activeOrWon = counts.won + counts.live + counts.pending;
  if (counts.live > 0 || (counts.won > 0 && activeOrWon === totalLegs)) {
    return "live";
  }

  if (counts.pending === totalLegs) {
    return "scheduled";
  }

  return status;
};

const isSettledStatus = (status: TicketStatus): boolean =>
  status === "won" ||
  status === "lost" ||
  status === "push" ||
  status === "partially_void";

export const evaluateTicket = (
  input: TicketEvaluationInput,
  now: Date = new Date()
): TicketEvaluationResult => {
  const status = deriveTicketStatus(input);
  const settledAt = isSettledStatus(status) ? (input.settledAt ?? now) : null;

  return {
    ...input,
    changed: input.status !== status,
    settledAt,
    status,
  };
};
