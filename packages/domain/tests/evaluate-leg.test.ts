import { describe, expect, test } from "bun:test";

import { evaluateLeg } from "../src/tracking/evaluate-leg";
import type {
  LegEvaluationInput,
  LegEventSnapshot,
} from "../src/tracking/types";

const NOW = new Date("2026-09-10T12:00:00.000Z");

const liveEvent: LegEventSnapshot = {
  awayParticipantId: "away",
  awayScore: 88,
  homeParticipantId: "home",
  homeScore: 91,
  status: "live",
};

const createLeg = (
  overrides: Partial<LegEvaluationInput> = {}
): LegEvaluationInput => ({
  currentValue: 3,
  event: liveEvent,
  lostAt: null,
  operator: "over",
  participantId: "home",
  settledAt: null,
  status: "live",
  targetValue: 3.5,
  wonAt: null,
  ...overrides,
});

describe("evaluateLeg", () => {
  test("settles over and gte legs as early wins", () => {
    const over = evaluateLeg(createLeg(), 4, NOW);
    const gte = evaluateLeg(
      createLeg({ operator: "gte", targetValue: 4 }),
      4,
      NOW
    );

    expect(over.status).toBe("won");
    expect(over.wonAt).toEqual(NOW);
    expect(over.settledAt).toEqual(NOW);
    expect(gte.status).toBe("won");
  });

  test("settles under and lte legs as early losses after exceeding the target", () => {
    const under = evaluateLeg(createLeg({ operator: "under" }), 4, NOW);
    const lte = evaluateLeg(createLeg({ operator: "lte" }), 4, NOW);

    expect(under.status).toBe("lost");
    expect(under.lostAt).toEqual(NOW);
    expect(lte.status).toBe("lost");
  });

  test("waits until final to award an under win", () => {
    const live = evaluateLeg(
      createLeg({ currentValue: 2, operator: "under" }),
      null,
      NOW
    );
    const final = evaluateLeg(
      createLeg({
        currentValue: 2,
        event: { ...liveEvent, status: "final" },
        operator: "under",
      }),
      null,
      NOW
    );

    expect(live.status).toBe("live");
    expect(live.settledAt).toBeNull();
    expect(final.status).toBe("won");
  });

  test("settles moneyline and spread legs from final scores", () => {
    const finalEvent = { ...liveEvent, status: "final" } as const;
    const moneyline = evaluateLeg(
      createLeg({ event: finalEvent, operator: "moneyline" }),
      null,
      NOW
    );
    const spread = evaluateLeg(
      createLeg({
        event: finalEvent,
        operator: "spread",
        participantId: "away",
        targetValue: 3,
      }),
      null,
      NOW
    );

    expect(moneyline.currentValue).toBe(91);
    expect(moneyline.status).toBe("won");
    expect(spread.currentValue).toBe(-3);
    expect(spread.status).toBe("push");
  });

  test("does not settle equals before the event is final", () => {
    const live = evaluateLeg(
      createLeg({ currentValue: 2, operator: "equals", targetValue: 2 }),
      null,
      NOW
    );
    const final = evaluateLeg(
      createLeg({
        currentValue: 2,
        event: { ...liveEvent, status: "final" },
        operator: "equals",
        targetValue: 2,
      }),
      null,
      NOW
    );

    expect(live.status).toBe("live");
    expect(final.status).toBe("won");
  });

  test("keeps a scheduled leg pending without an observation", () => {
    const result = evaluateLeg(
      createLeg({
        currentValue: null,
        event: { ...liveEvent, status: "scheduled" },
        status: "pending",
      }),
      null,
      NOW
    );

    expect(result.changed).toBeFalse();
    expect(result.status).toBe("pending");
  });
});
