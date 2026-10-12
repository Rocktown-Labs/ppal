/**
 * Gemini 3.8 Flash baseline for the extraction eval harness. Production
 * extraction runs on Workers AI (services/workers-ai.ts); this module exists
 * only to benchmark the previous provider with identical prompts and scoring.
 */

import {
  extractionPrompt,
  extractionSchemaGemini,
} from "../../apps/server/src/services/extraction-prompt";
import { extractionResultSchema } from "../../packages/contracts/src/uploads";
import type { ExtractionResult } from "../../packages/contracts/src/uploads";

const GEMINI_MODEL = "gemini-3.8-flash";

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
              { text: extractionPrompt },
              { inlineData: { data: base64, mimeType } },
            ],
            role: "user",
          },
        ],
        generationConfig: {
          responseJsonSchema: extractionSchemaGemini,
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
  const result = extractionResultSchema.parse(
    JSON.parse(text)
  ) as ExtractionResult;
  return { model: GEMINI_MODEL, raw, result };
};
