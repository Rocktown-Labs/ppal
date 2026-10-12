import { describe, expect, test } from "bun:test";

import type { ExtractionResult } from "@ppal/contracts/uploads";

import { buildPdfExtractionPrompt } from "../src/services/extraction-prompt";
import {
  applySettledOverride,
  hasSettledMarker,
  parseClefResponse,
  parseJsonText,
} from "../src/services/workers-ai";

const slipResult = (displayedResult: ExtractionResult["displayedResult"]) =>
  ({
    displayedResult,
    legs: [],
    sourceName: "FanDuel",
    ticketType: "parlay",
  }) as ExtractionResult;

describe("parseJsonText", () => {
  test("parses plain JSON", () => {
    expect(parseJsonText('{"ticketType":"parlay"}')).toEqual({
      ticketType: "parlay",
    });
  });

  test("parses JSON wrapped in prose", () => {
    const text = 'Here is the slip:\n{"ticketType":"single","legs":[]} done.';
    expect(parseJsonText(text)).toEqual({ legs: [], ticketType: "single" });
  });

  test("parses fenced JSON", () => {
    const text = '```json\n{"sourceName":"DraftKings"}\n```';
    expect(parseJsonText(text)).toEqual({ sourceName: "DraftKings" });
  });

  test("throws when no JSON is present", () => {
    expect(() => parseJsonText("no structured output here")).toThrow();
  });
});

describe("parseClefResponse", () => {
  test("maps noul probabilities to qualification fields", () => {
    const parsed = parseClefResponse({
      answers: {
        is_betting_slip: { noul: 0.94 },
        is_legible: { noul: 0.91 },
        shows_settled_result: { noul: 0.03 },
      },
    });
    expect(parsed).toEqual({
      isBettingSlip: 0.94,
      isLegible: 0.91,
      showsSettledResult: 0.03,
    });
  });

  test("defaults missing answers to zero", () => {
    const parsed = parseClefResponse({ answers: {} });
    expect(parsed.isBettingSlip).toBe(0);
    expect(parsed.showsSettledResult).toBe(0);
  });
});

describe("applySettledOverride", () => {
  test("nulls a claimed result when clef does not see a settled badge", () => {
    const result = slipResult("won");
    applySettledOverride(result, {
      isBettingSlip: 0.95,
      isLegible: 0.9,
      raw: null,
      showsSettledResult: 0.02,
    });
    expect(result.displayedResult).toBeNull();
  });

  test("keeps the result when clef confirms a settled badge", () => {
    const result = slipResult("won");
    applySettledOverride(result, {
      isBettingSlip: 0.95,
      isLegible: 0.9,
      raw: null,
      showsSettledResult: 0.94,
    });
    expect(result.displayedResult).toBe("won");
  });

  test("keeps the result when there is no clef verdict (PDFs, clef down)", () => {
    const result = slipResult("lost");
    applySettledOverride(result, null);
    expect(result.displayedResult).toBe("lost");
  });

  test("does nothing when the model already returned null", () => {
    const result = slipResult(null);
    applySettledOverride(result, {
      isBettingSlip: 0.95,
      isLegible: 0.9,
      raw: null,
      showsSettledResult: 0.02,
    });
    expect(result.displayedResult).toBeNull();
  });
});

describe("buildPdfExtractionPrompt", () => {
  test("embeds the converted slip text between markers", () => {
    const prompt = buildPdfExtractionPrompt("FanDuel - Chiefs ML -150");
    expect(prompt).toContain("uploaded as a PDF and converted to text");
    expect(prompt).toContain("<slip-text>");
    expect(prompt).toContain("FanDuel - Chiefs ML -150");
    expect(prompt).toContain("Return JSON only.");
  });
});

describe("hasSettledMarker", () => {
  test("detects settled-outcome wording", () => {
    expect(hasSettledMarker("Bet WON — paid $85.50")).toBeTrue();
    expect(hasSettledMarker("CASHED OUT $61.75")).toBeTrue();
    expect(hasSettledMarker("Status: Lost")).toBeTrue();
  });

  test("does not match open-slip wording like To Win", () => {
    expect(hasSettledMarker("Wager $25.00 To Win $67.50")).toBeFalse();
    expect(
      hasSettledMarker("Chiefs vs Raiders Sun 1:00 PM ET NFL")
    ).toBeFalse();
  });

  test("does not match player names containing outcome words", () => {
    expect(hasSettledMarker("Kyle Wong Over 12.5 Points")).toBeFalse();
  });
});
