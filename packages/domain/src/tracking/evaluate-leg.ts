import type { TicketLegStatus } from "@ppal/contracts/tickets";

import type { LegEvaluationInput, LegEvaluationResult } from "./types";

interface LegOutcome {
  currentValue: number | null;
  status: TicketLegStatus;
}

const evaluateTeamOutcome = (input: LegEvaluationInput): LegOutcome => {
  const { event, operator, participantId, targetValue } = input;
  if (!(event && participantId)) {
    return { currentValue: input.currentValue, status: input.status };
  }

  const isHome = event.homeParticipantId === participantId;
  const teamScore = isHome ? event.homeScore : event.awayScore;
  const opponentScore = isHome ? event.awayScore : event.homeScore;

  if (teamScore === null || opponentScore === null) {
    return { currentValue: input.currentValue, status: input.status };
  }

  const currentValue =
    operator === "spread" ? teamScore - opponentScore : teamScore;
  if (event.status === "live") {
    return { currentValue, status: "live" };
  }

  if (event.status !== "final") {
    return { currentValue, status: input.status };
  }

  const comparison =
    operator === "spread"
      ? currentValue + (targetValue ?? 0)
      : teamScore - opponentScore;
  if (comparison > 0) {
    return { currentValue, status: "won" };
  }
  if (comparison < 0) {
    return { currentValue, status: "lost" };
  }
  return { currentValue, status: "push" };
};

const unsettledNumericOutcome = (input: LegEvaluationInput): LegOutcome => ({
  currentValue: input.currentValue,
  status: input.event?.status === "live" ? "live" : input.status,
});

const evaluateIncreasingOutcome = (input: LegEvaluationInput): LegOutcome => {
  const { currentValue, operator, targetValue } = input;
  if (currentValue === null || targetValue === null) {
    return unsettledNumericOutcome(input);
  }

  const reachedTarget =
    operator === "over"
      ? currentValue > targetValue
      : currentValue >= targetValue;
  if (reachedTarget) {
    return { currentValue, status: "won" };
  }
  if (input.event?.status === "final") {
    return { currentValue, status: "lost" };
  }
  return unsettledNumericOutcome(input);
};

const evaluateDecreasingOutcome = (input: LegEvaluationInput): LegOutcome => {
  const { currentValue, targetValue } = input;
  if (currentValue === null || targetValue === null) {
    return unsettledNumericOutcome(input);
  }
  if (currentValue > targetValue) {
    return { currentValue, status: "lost" };
  }
  if (input.event?.status === "final") {
    return { currentValue, status: "won" };
  }
  return unsettledNumericOutcome(input);
};

const evaluateBooleanOutcome = (
  input: LegEvaluationInput,
  expectsMatch: boolean
): LegOutcome => {
  const { currentValue, targetValue } = input;
  if (currentValue === null || targetValue === null) {
    return unsettledNumericOutcome(input);
  }
  const matches = currentValue === targetValue;
  if (expectsMatch && matches) {
    return { currentValue, status: "won" };
  }
  if (input.event?.status === "final") {
    return {
      currentValue,
      status: matches === expectsMatch ? "won" : "lost",
    };
  }
  return unsettledNumericOutcome(input);
};

const evaluateEqualsOutcome = (input: LegEvaluationInput): LegOutcome => {
  const { currentValue, targetValue } = input;
  const canSettle =
    currentValue !== null &&
    targetValue !== null &&
    input.event?.status === "final";
  if (!canSettle) {
    return unsettledNumericOutcome(input);
  }
  return {
    currentValue,
    status: currentValue === targetValue ? "won" : "lost",
  };
};

const evaluateNumericOutcome = (input: LegEvaluationInput): LegOutcome => {
  if (input.operator === "over" || input.operator === "gte") {
    return evaluateIncreasingOutcome(input);
  }
  if (input.operator === "under" || input.operator === "lte") {
    return evaluateDecreasingOutcome(input);
  }
  if (input.operator === "yes") {
    return evaluateBooleanOutcome(input, true);
  }
  if (input.operator === "no") {
    return evaluateBooleanOutcome(input, false);
  }
  if (input.operator === "equals") {
    return evaluateEqualsOutcome(input);
  }
  return unsettledNumericOutcome(input);
};

const resolveTimestamps = (
  input: LegEvaluationInput,
  status: TicketLegStatus,
  now: Date
): Pick<LegEvaluationResult, "lostAt" | "settledAt" | "wonAt"> => {
  if (status === "won") {
    return {
      lostAt: null,
      settledAt: input.settledAt ?? now,
      wonAt: input.wonAt ?? now,
    };
  }
  if (status === "lost") {
    return {
      lostAt: input.lostAt ?? now,
      settledAt: input.settledAt ?? now,
      wonAt: null,
    };
  }
  if (status === "push") {
    return { lostAt: null, settledAt: input.settledAt ?? now, wonAt: null };
  }
  return { lostAt: null, settledAt: null, wonAt: null };
};

export const evaluateLeg = (
  input: LegEvaluationInput,
  newValue: number | null = null,
  now: Date = new Date()
): LegEvaluationResult => {
  const evaluationInput =
    newValue === null ? input : { ...input, currentValue: newValue };
  const isTeamOperator =
    input.operator === "moneyline" || input.operator === "spread";
  const outcome = isTeamOperator
    ? evaluateTeamOutcome(evaluationInput)
    : evaluateNumericOutcome(evaluationInput);
  const timestamps = resolveTimestamps(input, outcome.status, now);

  return {
    ...evaluationInput,
    ...outcome,
    ...timestamps,
    changed: input.status !== outcome.status,
  };
};
