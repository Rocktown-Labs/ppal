import { describe, expect, test } from "bun:test";

import {
  buildProgressLine,
  isProgressNotificationDue,
  pollingDelayMs,
} from "../src/services/sports-progress";

describe("sports progress notifications", () => {
  test("uses the ticket's requested cadence", () => {
    expect(pollingDelayMs(5)).toBe(300_000);
    expect(
      isProgressNotificationDue({
        interval: 15,
        lastNotifiedAt: 0,
        now: 899_999,
      })
    ).toBe(false);
    expect(
      isProgressNotificationDue({
        interval: 15,
        lastNotifiedAt: 0,
        now: 900_000,
      })
    ).toBe(true);
  });

  test("formats a player combo as progress toward its target", () => {
    expect(
      buildProgressLine({
        awayName: "Lakers",
        awayScore: 45,
        currentValue: 21,
        homeName: "Suns",
        homeScore: 42,
        id: "leg-1",
        lastNotifiedSnapshot: "18:live",
        marketSlug: "player_points_rebounds_assists",
        status: "live",
        subjectName: "LeBron James",
        targetValue: 30,
      })?.text
    ).toBe("LeBron James Points + Rebounds + Assists 21/30");
  });

  test("moneyline snapshots include both scores", () => {
    expect(
      buildProgressLine({
        awayName: "Bills",
        awayScore: 17,
        currentValue: 17,
        homeName: "Chiefs",
        homeScore: 21,
        id: "leg-2",
        lastNotifiedSnapshot: "17:14:live",
        marketSlug: "team_moneyline",
        status: "live",
        subjectName: "Bills",
        targetValue: null,
      })
    ).toMatchObject({
      snapshot: "17:21:live",
      text: "Bills moneyline — Bills 17, Chiefs 21",
    });
  });
});
