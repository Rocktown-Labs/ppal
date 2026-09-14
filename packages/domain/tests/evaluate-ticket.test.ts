import { describe, expect, test } from "bun:test";

import { evaluateTicket } from "../src/tracking/evaluate-ticket";

const NOW = new Date("2026-09-10T12:00:00.000Z");

describe("evaluateTicket", () => {
  test("wins when every leg wins", () => {
    const result = evaluateTicket(
      { legStatuses: ["won", "won"], settledAt: null, status: "live" },
      NOW
    );

    expect(result.changed).toBeTrue();
    expect(result.settledAt).toEqual(NOW);
    expect(result.status).toBe("won");
  });

  test("loses a parlay as soon as any leg loses", () => {
    const result = evaluateTicket(
      {
        legStatuses: ["won", "lost", "pending"],
        settledAt: null,
        status: "live",
      },
      NOW
    );

    expect(result.status).toBe("lost");
  });

  test("marks a winner with a push or void as partially void", () => {
    const pushed = evaluateTicket(
      { legStatuses: ["won", "push"], settledAt: null, status: "live" },
      NOW
    );
    const voided = evaluateTicket(
      { legStatuses: ["won", "cancelled"], settledAt: null, status: "live" },
      NOW
    );

    expect(pushed.status).toBe("partially_void");
    expect(voided.status).toBe("partially_void");
  });

  test("marks an all-push or void ticket as push", () => {
    const result = evaluateTicket(
      {
        legStatuses: ["push", "void", "cancelled"],
        settledAt: null,
        status: "live",
      },
      NOW
    );

    expect(result.status).toBe("push");
  });

  test("keeps draft and needs-review tickets unchanged", () => {
    const draft = evaluateTicket(
      { legStatuses: ["won"], settledAt: null, status: "draft" },
      NOW
    );
    const review = evaluateTicket(
      { legStatuses: ["won"], settledAt: null, status: "needs_review" },
      NOW
    );

    expect(draft.changed).toBeFalse();
    expect(draft.status).toBe("draft");
    expect(review.changed).toBeFalse();
    expect(review.status).toBe("needs_review");
  });

  test("schedules all-pending tickets and activates mixed live tickets", () => {
    const scheduled = evaluateTicket(
      { legStatuses: ["pending", "pending"], settledAt: null, status: "live" },
      NOW
    );
    const live = evaluateTicket(
      { legStatuses: ["won", "pending"], settledAt: null, status: "scheduled" },
      NOW
    );

    expect(scheduled.status).toBe("scheduled");
    expect(live.status).toBe("live");
  });
});
