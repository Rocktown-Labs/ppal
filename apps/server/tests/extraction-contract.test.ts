import { describe, expect, test } from "bun:test";

import { extractionResultSchema } from "@ppal/contracts/uploads";

describe("ticket extraction contract", () => {
  test("accepts heterogeneous and compound legs without splitting aggregates", () => {
    const result = extractionResultSchema.parse({
      displayedResult: null,
      legs: [
        {
          confidence: 0.99,
          description: "Lakers moneyline",
          eventHint: "vs Celtics",
          league: "NBA",
          market: "team_moneyline",
          marketComponents: [],
          operator: "moneyline",
          secondaryTargetValue: null,
          sport: "basketball",
          subjectName: "Los Angeles Lakers",
          subjectType: "team",
          targetValue: null,
        },
        {
          confidence: 0.97,
          description: "Nikola Jokic over 45.5 PTS + REB + AST",
          eventHint: "vs Suns",
          league: "NBA",
          market: "player_points_rebounds_assists",
          marketComponents: [
            "player_points",
            "player_rebounds",
            "player_assists",
          ],
          operator: "over",
          secondaryTargetValue: null,
          sport: "basketball",
          subjectName: "Nikola Jokic",
          subjectType: "player",
          targetValue: 45.5,
        },
      ],
      sourceName: "Sportsbook",
      ticketType: "parlay",
    });
    expect(result.legs).toHaveLength(2);
    expect(result.legs[1]?.marketComponents).toHaveLength(3);
  });

  test("rejects an empty or structurally fake ticket", () => {
    expect(() => extractionResultSchema.parse({ legs: [] })).toThrow();
  });
});
