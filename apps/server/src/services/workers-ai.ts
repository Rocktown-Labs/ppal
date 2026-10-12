import { extractionResultSchema } from "@ppal/contracts/uploads";
import type { ExtractionResult } from "@ppal/contracts/uploads";

import {
  buildPdfExtractionPrompt,
  extractionPrompt,
  extractionSchemaWorkersAi,
} from "./extraction-prompt";

const EXTRACTION_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const CLEF_MODEL = "@cf/cloudflare/clef-flash";

/** Cap converted PDF text so a pathological document can't blow the context window. */
const MAX_PDF_TEXT_CHARS = 20_000;
/** A converted PDF with less readable text than this is treated as unreadable. */
const MIN_PDF_TEXT_CHARS = 40;

/**
 * Matches settled-outcome markers that appear on cashed-out/settled slips.
 * Deliberately excludes bare "win" (every open slip shows "To Win $X").
 */
const SETTLED_MARKER_PATTERN =
  /\b(?<marker>won|lost|cash(?:ed)? out|paid|push|void(?:ed)?|settled|graded|refund(?:ed)?)\b/iu;

/**
 * PDFs have no clef verdict (clef only accepts image/* inputs), but the
 * converted text itself is a reliable signal: settled slips contain outcome
 * markers ("WON", "CASHED OUT", "PAID"), open slips do not. When no marker
 * is present, a claimed displayedResult is discarded — the text-mode
 * equivalent of the clef settled override.
 */
export const hasSettledMarker = (slipText: string): boolean =>
  SETTLED_MARKER_PATTERN.test(slipText);

/**
 * clef reads settled badges reliably (94-95% confidence on settled tickets,
 * 1-18% on open ones) while extraction models hallucinate results on open
 * tickets. Below this threshold the extractor's displayedResult is discarded.
 */
export const SETTLED_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Extraction models hallucinate ticket-level settled results on open tickets
 * (every Workers AI model did so in the eval), so clef's reading of the
 * image is authoritative: if clef does not see a settled badge, any
 * displayedResult the extractor claimed is discarded. PDFs have no clef
 * verdict (clef only accepts image/* inputs), so their claimed results stand.
 */
export const applySettledOverride = (
  result: ExtractionResult,
  qualification: SlipQualification | null
): void => {
  if (
    qualification &&
    qualification.showsSettledResult < SETTLED_CONFIDENCE_THRESHOLD &&
    result.displayedResult !== null
  ) {
    result.displayedResult = null;
  }
};

/**
 * clef answers arrive as { answers: { <id>: { type: "noul", noul: <probability> } } },
 * where the noul probability is the model's confidence in "yes".
 */
interface ClefResponse {
  answers?: Record<string, { noul?: number } | undefined>;
}

export interface SlipQualification {
  isBettingSlip: number;
  isLegible: number;
  showsSettledResult: number;
  raw: unknown;
}

export const parseClefResponse = (
  raw: ClefResponse
): Omit<SlipQualification, "raw"> => {
  const answer = (id: string): number => raw.answers?.[id]?.noul ?? 0;
  return {
    isBettingSlip: answer("is_betting_slip"),
    isLegible: answer("is_legible"),
    showsSettledResult: answer("shows_settled_result"),
  };
};

const toDataUrl = (bytes: ArrayBuffer, mimeType: string): string => {
  const binary = new Uint8Array(bytes);
  let binaryString = "";
  const chunkSize = 8192;
  for (let index = 0; index < binary.length; index += chunkSize) {
    binaryString += String.fromCodePoint(
      ...binary.subarray(index, index + chunkSize)
    );
  }
  return `data:${mimeType};base64,${btoa(binaryString)}`;
};

/**
 * Cheap pre-gate (~$0.00004, <1s): classifies the upload before extraction.
 * clef reads settled badges far more reliably than the extraction models —
 * in the eval it scored 94-95% confidence on settled tickets vs 1-18% on
 * open ones, while every extractor hallucinated results on open tickets.
 */
export const qualifySlipImage = async (
  workerEnv: Env,
  bytes: ArrayBuffer,
  mimeType: string
): Promise<SlipQualification> => {
  const raw = (await workerEnv.AI.run(CLEF_MODEL, {
    images: [toDataUrl(bytes, mimeType)],
    model: "clef-flash",
    questions: {
      is_betting_slip: {
        instructions:
          "Is this image a sportsbook or betting app bet slip or screenshot showing wagers?",
        type: "noul",
      },
      is_legible: {
        instructions:
          "Is the text in the image clearly legible enough to transcribe the wagers?",
        type: "noul",
      },
      shows_settled_result: {
        instructions:
          "Does the image show a settled or cashed-out outcome, such as a won/lost badge or cash-out receipt?",
        type: "noul",
      },
    },
    state:
      "Evaluate the attached image for a sports betting slip processing pipeline.",
  })) as ClefResponse;

  return { ...parseClefResponse(raw), raw };
};

interface VisionResponse {
  response?: string;
  text?: string;
  choices?: { message?: { content?: string } }[];
}

/**
 * Workers AI text-generation models return the generated text under
 * different shapes depending on model and endpoint version
 * (`response`, `text`, or OpenAI-style `choices[0].message.content`).
 */
const extractResponseText = (raw: VisionResponse): string | undefined => {
  if (typeof raw.response === "string") {
    return raw.response;
  }
  if (typeof raw.text === "string") {
    return raw.text;
  }
  const content = raw.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : undefined;
};

export const parseJsonText = (text: string): unknown => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to lenient extraction
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error("Workers AI returned no parseable JSON extraction");
};

interface TextContentPart {
  type: "text";
  text: string;
}

interface ImageContentPart {
  type: "image_url";
  image_url: { url: string };
}

const runExtractionModel = async (
  workerEnv: Env,
  content: (TextContentPart | ImageContentPart)[]
): Promise<VisionResponse> =>
  (await workerEnv.AI.run(EXTRACTION_MODEL, {
    chat_template_kwargs: { enable_thinking: false },
    max_tokens: 4096,
    messages: [
      {
        content,
        role: "user",
      },
    ],
    response_format: {
      json_schema: {
        name: "ticket_extraction",
        schema: extractionSchemaWorkersAi,
        strict: true,
      },
      type: "json_schema",
    },
    temperature: 0,
  })) as VisionResponse;

/**
 * Bet-slip extraction on Workers AI (Gemma 4 26B A4B). The schema uses
 * standard JSON-Schema nullability — see extraction-prompt.ts.
 */
export const extractTicketWithWorkersAI = async ({
  bytes,
  mimeType,
  workerEnv,
}: {
  bytes: ArrayBuffer;
  mimeType: string;
  workerEnv: Env;
}): Promise<{
  model: string;
  raw: VisionResponse;
  result: ExtractionResult;
}> => {
  const raw = await runExtractionModel(workerEnv, [
    { text: extractionPrompt, type: "text" },
    { image_url: { url: toDataUrl(bytes, mimeType) }, type: "image_url" },
  ]);

  const text = extractResponseText(raw);
  if (!text) {
    throw new Error("Workers AI returned no structured extraction");
  }
  const result = extractionResultSchema.parse(
    parseJsonText(text)
  ) as ExtractionResult;
  return { model: EXTRACTION_MODEL, raw, result };
};

interface MarkdownConversion {
  data?: string;
  format?: string;
}

/**
 * Bet-slip extraction from PDF uploads. Workers AI vision models only accept
 * image/* MIME types, so the PDF is first converted to text with
 * env.AI.toMarkdown() and the model extracts from that text. Scanned
 * (image-only) PDFs convert to little or no text and are rejected with a
 * friendly message asking for a screenshot instead.
 */
export const extractTicketFromPdf = async ({
  bytes,
  workerEnv,
}: {
  bytes: ArrayBuffer;
  workerEnv: Env;
}): Promise<{
  model: string;
  raw: { toMarkdown: unknown; extraction: VisionResponse };
  result: ExtractionResult;
}> => {
  const conversions = await workerEnv.AI.toMarkdown([
    {
      blob: new Blob([bytes], { type: "application/pdf" }),
      name: "slip.pdf",
    },
  ]);
  const converted = (
    Array.isArray(conversions) ? conversions[0] : conversions
  ) as MarkdownConversion | undefined;
  const slipText = converted?.data?.trim() ?? "";
  if (converted?.format === "error" || slipText.length < MIN_PDF_TEXT_CHARS) {
    throw new Error(
      "We couldn't read any text from this PDF — try uploading a screenshot of your bet instead."
    );
  }

  const raw = await runExtractionModel(workerEnv, [
    {
      text: buildPdfExtractionPrompt(slipText.slice(0, MAX_PDF_TEXT_CHARS)),
      type: "text",
    },
  ]);
  const text = extractResponseText(raw);
  if (!text) {
    throw new Error("Workers AI returned no structured extraction");
  }
  const result = extractionResultSchema.parse(
    parseJsonText(text)
  ) as ExtractionResult;
  // No clef verdict exists for PDFs — the converted text stands in: if it
  // contains no settled-outcome marker, discard any claimed result.
  if (!hasSettledMarker(slipText) && result.displayedResult !== null) {
    result.displayedResult = null;
  }
  return {
    model: EXTRACTION_MODEL,
    raw: { extraction: raw, toMarkdown: converted },
    result,
  };
};
