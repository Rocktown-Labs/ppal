import { supportedMarketSlugs } from "@ppal/contracts/markets";

/**
 * Single source of truth for the bet-slip extraction prompt and its JSON
 * schemas. Kept in one module so the eval harness (evals/extraction/run.ts)
 * always benchmarks exactly what production sends.
 */
/**
 * Rules shared by every extraction input mode (image vision + PDF text).
 * Input-specific framing is added by the callers below.
 */
const extractionRules = `Rules:
1. Extract every independent selection exactly once. Do not treat stake, payout, odds boosts, or promotional text as legs.
2. Preserve all visible selection wording in description. Never invent names, lines, dates, leagues, or results. Use null for unavailable nullable fields and lower confidence when uncertain.
3. A straight wager has one leg. Parlays, same-game parlays, teasers, round robins, PrizePicks/Underdog entries, and bet-builder screenshots can contain many heterogeneous legs.
4. Normalize market to one of these supported lowercase snake_case slugs: ${supportedMarketSlugs.join(", ")}. If a visible market is not represented, preserve its wording in description, choose the closest semantically correct supported slug only when unambiguous, and lower confidence; never invent support.
5. Compound player props must remain ONE leg. Use an additive canonical slug and list each canonical component in marketComponents. Examples: Points + Rebounds + Assists => player_points_rebounds_assists with [player_points, player_rebounds, player_assists]; Points + Rebounds => player_points_rebounds; Passing + Rushing Yards => player_passing_rushing_yards. Do not split one compound line into multiple legs.
6. marketComponents is [] for a simple market. For a compound market it contains only components that must be summed. Never include the aggregate slug itself.
7. operator rules: moneyline selections use operator "moneyline" and MUST set targetValue and secondaryTargetValue to null (never 0, 1, or an odds number). Point-spread selections (including teasers, e.g. "Bills -2.5" or "Chiefs +8.5") use operator "spread" with the signed visible line in targetValue — never over/under. Total and prop lines ("Over 44.5", "Under 23.5 Pass Yds") use operator "over" or "under" with the line in targetValue. For range/band markets use targetValue as the lower bound and secondaryTargetValue as the upper bound. Preserve half points.
8. subjectName is the player, team, driver, fighter, golfer, or game named by the selection; subjectType is player, team, or game. Drivers, fighters, and golfers use player.
9. eventHint should compactly preserve visible opponent, matchup, event, round, and date clues. sport and league use recognizable canonical names when visible or strongly implied by an explicit league logo.
10. displayedResult is only a ticket-level settled result visibly shown by the sportsbook. Do not infer it from cash-out value or leg colors. If the image shows no settled/cashed-out badge, use null.
11. confidence reflects transcription and semantic certainty for the leg from 0 to 1, not whether the bet will win.`;

/** Prompt for image (vision) extraction. */
export const extractionPrompt = `You are a sportsbook bet-slip extraction engine. Read the entire image, including scroll captures and settled-ticket badges, and return one JSON object matching the supplied schema.

${extractionRules}

Return JSON only.`;

/**
 * Builds the prompt for PDF extraction. The PDF is first converted to text
 * with env.AI.toMarkdown() (vision models only accept image/* MIME types),
 * so the model extracts from the converted slip text instead of an image.
 */
export const buildPdfExtractionPrompt = (slipText: string): string =>
  `You are a sportsbook bet-slip extraction engine. The bet slip was uploaded as a PDF and converted to text; the converted content of the entire document appears between the markers. Extract from that text and return one JSON object matching the supplied schema.

${extractionRules}

<slip-text>
${slipText}
</slip-text>

Return JSON only.`;

const baseLegProperties = {
  confidence: { maximum: 1, minimum: 0, type: "number" },
  description: { type: "string" },
  eventHint: { nullable: true, type: "string" },
  league: { nullable: true, type: "string" },
  market: { type: "string" },
  marketComponents: { items: { type: "string" }, type: "array" },
  operator: {
    enum: [
      "over",
      "under",
      "gte",
      "lte",
      "equals",
      "moneyline",
      "spread",
      "yes",
      "no",
      "custom",
    ],
    type: "string",
  },
  secondaryTargetValue: { nullable: true, type: "number" },
  sport: { nullable: true, type: "string" },
  subjectName: { type: "string" },
  subjectType: { enum: ["player", "team", "game"], type: "string" },
  targetValue: { nullable: true, type: "number" },
} as const;

const baseRequired = [
  "confidence",
  "description",
  "eventHint",
  "league",
  "market",
  "marketComponents",
  "operator",
  "secondaryTargetValue",
  "sport",
  "subjectName",
  "subjectType",
  "targetValue",
] as const;

/**
 * responseJsonSchema for the Google Generative Language API, which uses the
 * OpenAPI-style `nullable: true` marker. Gemini handles this natively.
 */
export const extractionSchemaGemini = {
  additionalProperties: false,
  properties: {
    displayedResult: {
      enum: ["won", "lost", "push", "void"],
      nullable: true,
      type: "string",
    },
    legs: {
      items: {
        additionalProperties: false,
        properties: baseLegProperties,
        required: [...baseRequired],
        type: "object",
      },
      type: "array",
    },
    sourceName: { nullable: true, type: "string" },
    ticketType: {
      enum: ["parlay", "single", "sgp", "teaser", "round_robin"],
      type: "string",
    },
  },
  required: ["displayedResult", "legs", "sourceName", "ticketType"],
  type: "object",
} as const;

/**
 * Standard JSON Schema for Workers AI. Its guided-JSON engine ignores
 * OpenAPI-style `nullable: true` and would force numbers into nullable
 * fields, so nullability is expressed as `type: ["x", "null"]` instead.
 * Verified in evals/extraction: this is what took moneyline targetValue
 * accuracy from 43% to 99-100%.
 */
export const extractionSchemaWorkersAi = {
  additionalProperties: false,
  properties: {
    displayedResult: {
      enum: ["won", "lost", "push", "void"],
      type: ["string", "null"],
    },
    legs: {
      items: {
        additionalProperties: false,
        properties: {
          confidence: { maximum: 1, minimum: 0, type: "number" },
          description: { type: "string" },
          eventHint: { type: ["string", "null"] },
          league: { type: ["string", "null"] },
          market: { type: "string" },
          marketComponents: { items: { type: "string" }, type: "array" },
          operator: {
            enum: [
              "over",
              "under",
              "gte",
              "lte",
              "equals",
              "moneyline",
              "spread",
              "yes",
              "no",
              "custom",
            ],
            type: "string",
          },
          secondaryTargetValue: { type: ["number", "null"] },
          sport: { type: ["string", "null"] },
          subjectName: { type: "string" },
          subjectType: { enum: ["player", "team", "game"], type: "string" },
          targetValue: { type: ["number", "null"] },
        },
        required: [...baseRequired],
        type: "object",
      },
      type: "array",
    },
    sourceName: { type: ["string", "null"] },
    ticketType: {
      enum: ["parlay", "single", "sgp", "teaser", "round_robin"],
      type: "string",
    },
  },
  required: ["displayedResult", "legs", "sourceName", "ticketType"],
  type: "object",
} as const;
