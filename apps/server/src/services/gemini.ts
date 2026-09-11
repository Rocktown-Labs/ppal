import { extractionResultSchema } from "@ppal/contracts/uploads";
import type { ExtractionResult } from "@ppal/contracts/uploads";

const GEMINI_MODEL = "gemini-3.8-flash";

const responseJsonSchema = {
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
        properties: {
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
        },
        required: [
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
        ],
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

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
  error?: { message?: string };
}

export const extractTicketWithGemini = async ({
  apiKey,
  bytes,
  mimeType,
}: {
  apiKey: string;
  bytes: ArrayBuffer;
  mimeType: string;
}): Promise<{
  model: string;
  raw: GeminiResponse;
  result: ExtractionResult;
}> => {
  const base64 = Buffer.from(bytes).toString("base64");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a sportsbook bet-slip extraction engine. Read the entire image, including scroll captures and settled-ticket badges, and return one JSON object matching the supplied schema.

Rules:
1. Extract every independent selection exactly once. Do not treat stake, payout, odds boosts, or promotional text as legs.
2. Preserve all visible selection wording in description. Never invent names, lines, dates, leagues, or results. Use null for unavailable nullable fields and lower confidence when uncertain.
3. A straight wager has one leg. Parlays, same-game parlays, teasers, round robins, PrizePicks/Underdog entries, and bet-builder screenshots can contain many heterogeneous legs.
4. Normalize market to a lowercase snake_case canonical slug. Common examples: team_moneyline, team_spread, game_total, player_points, player_rebounds, player_assists, player_three_pointers_made, player_passing_yards, player_receiving_yards, player_rushing_yards, player_hits, player_home_runs, player_goals, player_shots_on_target, first_touchdown_scorer, anytime_touchdown_scorer, race_winner, finish_position, tournament_winner, leaderboard_position.
5. Compound player props must remain ONE leg. Use an additive canonical slug and list each canonical component in marketComponents. Examples: Points + Rebounds + Assists => player_points_rebounds_assists with [player_points, player_rebounds, player_assists]; Points + Rebounds => player_points_rebounds; Passing + Rushing Yards => player_passing_rushing_yards. Do not split one compound line into multiple legs.
6. marketComponents is [] for a simple market. For a compound market it contains only components that must be summed. Never include the aggregate slug itself.
7. moneyline has targetValue null. Spreads keep the signed visible line. For range/band markets use targetValue as the lower bound and secondaryTargetValue as the upper bound. Preserve half points.
8. subjectName is the player, team, driver, fighter, golfer, or game named by the selection; subjectType is player, team, or game. Drivers, fighters, and golfers use player.
9. eventHint should compactly preserve visible opponent, matchup, event, round, and date clues. sport and league use recognizable canonical names when visible or strongly implied by an explicit league logo.
10. displayedResult is only a ticket-level settled result visibly shown by the sportsbook. Do not infer it from cash-out value or leg colors.
11. confidence reflects transcription and semantic certainty for the leg from 0 to 1, not whether the bet will win.

Return JSON only.`,
              },
              { inlineData: { data: base64, mimeType } },
            ],
            role: "user",
          },
        ],
        generationConfig: {
          responseJsonSchema,
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      method: "POST",
    }
  );
  const raw = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    throw new Error(
      raw.error?.message ?? `Gemini request failed (${response.status})`
    );
  }
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no structured extraction");
  }
  const result = extractionResultSchema.parse(JSON.parse(text));
  return { model: GEMINI_MODEL, raw, result };
};
