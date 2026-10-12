#!/usr/bin/env bun
/**
 * Extraction model eval harness.
 *
 * Runs bet-slip extraction over local fixture images against multiple Workers AI
 * vision models (and optionally the current Gemini baseline), scores the outputs
 * against optional ground-truth labels, and writes a markdown report + raw JSON.
 *
 * Usage:
 *   bun evals/extraction/run.ts
 *   bun evals/extraction/run.ts --models gemma4,llama4scout --limit 5
 *   bun evals/extraction/run.ts --extended --qualify
 *   bun evals/extraction/run.ts --models gemma4 --images-dir ./my-images
 *
 * Env (evals/extraction/.env.local or process.env):
 *   CF_ACCOUNT_ID / CLOUDFLARE_ACCOUNT_ID  - Cloudflare account id
 *   CF_API_TOKEN  / CLOUDFLARE_API_TOKEN   - API token with Workers AI edit permission
 *   GEMINI_API_KEY                          - optional, enables the Gemini baseline
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { config } from "dotenv";
import { z } from "zod";

import {
  extractionPrompt as basePrompt,
  extractionSchemaWorkersAi as responseJsonSchema,
} from "../../apps/server/src/services/extraction-prompt";
import { extractionResultSchema } from "../../packages/contracts/src/uploads";
import type { ExtractionResult } from "../../packages/contracts/src/uploads";
import { extractTicketWithGemini } from "./gemini-baseline";

const { join } = path;

config({
  path: new URL(".env.local", import.meta.url).pathname,
  quiet: true,
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);

const flagValue = (name: string): string | undefined => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
};

const hasFlag = (name: string): boolean => argv.includes(`--${name}`);

const EXTENDED = hasFlag("extended");
const QUALIFY = hasFlag("qualify");
const LIMIT = Number(flagValue("limit") ?? Number.POSITIVE_INFINITY);
const CONCURRENCY = Math.max(1, Number(flagValue("concurrency") ?? 3));
const SCRIPT_DIR = new URL(".", import.meta.url).pathname;

const IMAGES_DIR = flagValue("images-dir") ?? join(SCRIPT_DIR, "fixtures");
const OUT_DIR =
  flagValue("out") ??
  join(
    SCRIPT_DIR,
    "results",
    new Date().toISOString().replaceAll(/[:.]/gu, "-")
  );
const NO_BASELINE = hasFlag("no-baseline");

// ---------------------------------------------------------------------------
// Model registry (pricing from developers.cloudflare.com/workers-ai/platform/pricing)
// ---------------------------------------------------------------------------

interface ModelSpec {
  key: string;
  id: string;
  label: string;
  inPerM: number;
  outPerM: number;
  supportsThinkingOff: boolean;
  requiresPaidPlan?: boolean;
}

const WORKERS_AI_MODELS: ModelSpec[] = [
  {
    id: "@cf/google/gemma-4-26b-a4b-it",
    inPerM: 0.1,
    key: "gemma4",
    label: "Gemma 4 26B A4B",
    outPerM: 0.3,
    supportsThinkingOff: true,
  },
  {
    id: "@cf/meta/llama-4-scout-17b-16e-instruct",
    inPerM: 0.27,
    key: "llama4scout",
    label: "Llama 4 Scout 17B",
    outPerM: 0.85,
    supportsThinkingOff: false,
  },
  {
    id: "@cf/qwen/qwen3.8-27b",
    inPerM: 0.45,
    key: "qwen38",
    label: "Qwen 3.8 27B",
    outPerM: 3.2,
    supportsThinkingOff: true,
  },
  {
    id: "@cf/meta/llama-3.2-11b-vision-instruct",
    inPerM: 0.049,
    key: "llama32vision",
    label: "Llama 3.2 11B Vision",
    outPerM: 0.676,
    supportsThinkingOff: false,
  },
  {
    id: "@cf/zai-org/glm-5.3-flash",
    inPerM: 0.15,
    key: "glm53flash",
    label: "GLM 5.3 Flash",
    outPerM: 0.5,
    requiresPaidPlan: true,
    supportsThinkingOff: true,
  },
];

const resolveModels = (raw: string | undefined): ModelSpec[] => {
  if (!raw) {
    return WORKERS_AI_MODELS;
  }
  return raw.split(",").map((token) => {
    const needle = token.trim();
    const match = WORKERS_AI_MODELS.find(
      (model) =>
        model.key === needle || model.id === needle || model.id.includes(needle)
    );
    if (!match) {
      console.error(`Unknown model "${needle}". Available keys:`);
      for (const model of WORKERS_AI_MODELS) {
        console.error(`  ${model.key}  (${model.id})`);
      }
      process.exit(1);
    }
    return match;
  });
};

const SELECTED_MODELS = resolveModels(flagValue("models"));

// ---------------------------------------------------------------------------
// Env resolution
// ---------------------------------------------------------------------------

const parseDevVars = (): void => {
  const devVarsPath = join(SCRIPT_DIR, "../../apps/server/.dev.vars");
  if (!existsSync(devVarsPath)) {
    return;
  }
  for (const line of readFileSync(devVarsPath, "utf-8").split("\n")) {
    const match = line.match(
      /^\s*(?<key>[A-Z0-9_]+)\s*=\s*"?(?<value>[^"\r\n]*)"?\s*$/u
    );
    const { key, value } = match?.groups ?? {};
    if (key && value !== undefined && !process.env[key]) {
      process.env[key] = value;
    }
  }
};

parseDevVars();

const geminiApiKey = process.env.GEMINI_API_KEY;

// ---------------------------------------------------------------------------
// Cloudflare auth: static token if provided, otherwise wrangler's OAuth
// session (auto-refreshed via `wrangler whoami` when expired).
// ---------------------------------------------------------------------------

const WRANGLER_CONFIG = join(
  homedir(),
  "Library/Preferences/.wrangler/config/default.toml"
);
const WRANGLER_BIN = join(
  SCRIPT_DIR,
  "../../apps/server/node_modules/.bin/wrangler"
);

const readWranglerToken = ():
  | { token: string; expiresAt: number }
  | undefined => {
  if (!existsSync(WRANGLER_CONFIG)) {
    return undefined;
  }
  const contents = readFileSync(WRANGLER_CONFIG, "utf-8");
  const token = contents.match(/oauth_token\s*=\s*"(?<token>[^"]+)"/u)?.groups
    ?.token;
  const expires = contents.match(/expiration_time\s*=\s*"(?<expires>[^"]+)"/u)
    ?.groups?.expires;
  if (!token || !expires) {
    return undefined;
  }
  return { expiresAt: new Date(expires).getTime(), token };
};

const refreshWranglerToken = (): void => {
  if (!existsSync(WRANGLER_BIN)) {
    return;
  }
  try {
    spawnSync(WRANGLER_BIN, ["whoami"], { stdio: "ignore", timeout: 90_000 });
  } catch {
    // best effort only
  }
};

const resolveApiToken = (): string => {
  const envToken = process.env.CF_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
  if (envToken) {
    return envToken;
  }
  const wrangler = readWranglerToken();
  if (!wrangler) {
    console.error("Missing CF_API_TOKEN and no wrangler OAuth session found.");
    console.error(
      "Either set CF_API_TOKEN in evals/extraction/.env.local, or run `wrangler login` in apps/server."
    );
    process.exit(1);
  }
  if (wrangler.expiresAt <= Date.now() + 60_000 && existsSync(WRANGLER_BIN)) {
    console.log("wrangler token expired — refreshing via `wrangler whoami`...");
    refreshWranglerToken();
    return readWranglerToken()?.token ?? wrangler.token;
  }
  return wrangler.token;
};

const apiToken = resolveApiToken();
// Mutable so a mid-run expiry can be recovered by refreshing wrangler's OAuth token.
let activeApiToken = apiToken;

const refreshAndGetToken = (): string => {
  refreshWranglerToken();
  const refreshed = readWranglerToken();
  if (refreshed) {
    activeApiToken = refreshed.token;
    console.log("wrangler token refreshed mid-run");
  }
  return activeApiToken;
};

// Resolved at startup (env var or auto-discovered via the API).
let activeAccountId: string | undefined =
  process.env.CF_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;

// ---------------------------------------------------------------------------
// Extraction schema + prompt (imported from apps/server/src/services/
// extraction-prompt.ts — the production single source of truth)
// ---------------------------------------------------------------------------

const extendedSchema = (): Record<string, unknown> => {
  const schema = structuredClone(responseJsonSchema) as unknown as {
    properties: Record<string, unknown>;
    required: string[];
  };
  const legs = schema.properties.legs as {
    items: { properties: Record<string, unknown>; required: string[] };
  };
  legs.items.properties.eventDate = { type: ["string", "null"] };
  legs.items.required = [...legs.items.required, "eventDate"];
  return schema;
};

const extendedPrompt = `${basePrompt}
12. eventDate: if a date is visible for a selection (for example "Sun 12/7", "Today", "12/7"), set eventDate to the ISO date (YYYY-MM-DD), resolving relative to today. If no date is visible or it cannot be determined, use null.`;

const activeSchema = EXTENDED ? extendedSchema() : responseJsonSchema;
const activePrompt = EXTENDED ? extendedPrompt : basePrompt;

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

const MIME_BY_EXT: Record<string, string> = {
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".webp": "image/webp",
};

const PDF_CACHE_DIR = join(SCRIPT_DIR, "fixtures", ".converted");

const sanitizeFilename = (name: string): string =>
  name.replaceAll(/[^a-zA-Z0-9._-]/gu, "_");

/**
 * Loads fixture bytes, converting PDFs to PNG on first use (page 1 via
 * qlmanage, falling back to sips) since vision models take images, not PDFs.
 */
const loadFixtureBytes = (file: string): { bytes: Buffer; mime: string } => {
  const ext = file.toLowerCase().slice(file.lastIndexOf("."));
  if (ext !== ".pdf") {
    return {
      bytes: readFileSync(join(IMAGES_DIR, file)),
      mime: MIME_BY_EXT[ext] ?? "image/jpeg",
    };
  }
  mkdirSync(PDF_CACHE_DIR, { recursive: true });
  const cachePath = join(PDF_CACHE_DIR, `${sanitizeFilename(file)}.png`);
  if (!existsSync(cachePath)) {
    const source = join(IMAGES_DIR, file);
    try {
      execFileSync(
        "qlmanage",
        ["-t", "-s", "2048", "-o", PDF_CACHE_DIR, source],
        {
          stdio: "ignore",
          timeout: 60_000,
        }
      );
      // qlmanage writes <basename>.pdf.png (and sometimes <basename>.png).
      const candidates = [
        join(PDF_CACHE_DIR, `${file}.png`),
        join(PDF_CACHE_DIR, `${file.replace(/\.pdf$/iu, "")}.png`),
      ];
      const produced = candidates.find((candidate) => existsSync(candidate));
      if (produced && produced !== cachePath) {
        writeFileSync(cachePath, readFileSync(produced));
      }
    } catch {
      // fall through to sips
    }
    if (!existsSync(cachePath)) {
      execFileSync(
        "sips",
        ["-s", "format", "png", source, "--out", cachePath],
        {
          stdio: "ignore",
          timeout: 60_000,
        }
      );
    }
  }
  return { bytes: readFileSync(cachePath), mime: "image/png" };
};

const sleep = (ms: number): Promise<void> =>
  // Standard timer pattern; Promise.withResolvers adds nothing here.
  // eslint-disable-next-line promise/avoid-new
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = Array.from({ length: items.length }) as R[];
  let cursor = 0;
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) {
        // Sequential awaits here are intentional: each worker processes one item at a time.
        // eslint-disable-next-line unicorn/no-await-in-loop
        results[index] = await fn(item, index);
      }
    }
  });
  await Promise.all(workers);
  return results;
};

const levenshteinRatio = (a: string, b: string): number => {
  if (a === b) {
    return 1;
  }
  const rows = a.length;
  const cols = b.length;
  if (rows === 0 || cols === 0) {
    return 0;
  }
  let previous = Array.from({ length: cols + 1 }, (_, i) => i);
  for (let i = 1; i <= rows; i += 1) {
    const current: number[] = [i];
    for (let j = 1; j <= cols; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + substitutionCost
      );
    }
    previous = current;
  }
  return 1 - (previous[cols] ?? 0) / Math.max(rows, cols);
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();

const jaccard = (a: string, b: string): number => {
  const tokensA = new Set(normalizeText(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }
  return intersection / (tokensA.size + tokensB.size - intersection);
};

const similarity = (a: string, b: string): number =>
  Math.max(levenshteinRatio(normalizeText(a), normalizeText(b)), jaccard(a, b));

const numbersEqual = (
  a: number | null | undefined,
  b: number | null | undefined
): boolean => {
  if (a === null || a === undefined) {
    return b === null || b === undefined;
  }
  if (b === null || b === undefined) {
    return false;
  }
  return Math.abs(a - b) < 1e-6;
};

const tryParseJson = (text: string): unknown | undefined => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to lenient extraction
  }
  const fenced = trimmed.match(/```(?:json)?\s*(?<json>[\s\S]*?)```/u);
  if (fenced?.groups?.json) {
    try {
      return JSON.parse(fenced.groups.json.trim());
    } catch {
      // fall through
    }
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      // fall through
    }
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

interface CloudflareCall {
  text: string | undefined;
  usageIn: number | undefined;
  usageOut: number | undefined;
  guidedJson: boolean;
  configUsed: string;
  raw: unknown;
  lastError?: string;
}

interface AttemptConfig {
  responseFormat: boolean;
  thinkingOff: boolean;
}

const describeConfig = (attemptConfig: AttemptConfig): string =>
  `response_format=${attemptConfig.responseFormat ? "json_schema" : "off"},thinking_off=${attemptConfig.thinkingOff}`;

const unwrapEnvelope = (data: unknown): unknown => {
  if (
    typeof data === "object" &&
    data !== null &&
    "result" in data &&
    "success" in data
  ) {
    return (data as { result: unknown }).result;
  }
  return data;
};

const extractText = (data: unknown): string | undefined => {
  if (typeof data === "string") {
    return data;
  }
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.response === "string") {
    return record.response;
  }
  if (typeof record.text === "string") {
    return record.text;
  }
  const { choices } = record;
  if (Array.isArray(choices)) {
    const message = (
      choices[0] as { message?: { content?: unknown } } | undefined
    )?.message;
    if (typeof message?.content === "string") {
      return message.content;
    }
    if (Array.isArray(message?.content)) {
      const parts = message.content as { type?: string; text?: string }[];
      return parts
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("");
    }
  }
  return undefined;
};

const extractUsage = (
  data: unknown
): { in: number | undefined; out: number | undefined } => {
  let usage: unknown = data;
  if (typeof data === "object" && data !== null) {
    usage = (data as Record<string, unknown>).usage ?? data;
  }
  if (typeof usage !== "object" || usage === null) {
    return { in: undefined, out: undefined };
  }
  const record = usage as Record<string, unknown>;
  const input = record.prompt_tokens ?? record.input_tokens;
  const output = record.completion_tokens ?? record.output_tokens;
  return {
    in: typeof input === "number" ? input : undefined,
    out: typeof output === "number" ? output : undefined,
  };
};

const callWorkersAI = async (
  modelId: string,
  body: Record<string, unknown>
): Promise<{ status: number; data: unknown; error?: string }> => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${activeAccountId}/ai/run/${modelId}`,
    {
      body: JSON.stringify(body),
      headers: {
        authorization: `Bearer ${activeApiToken}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(180_000),
    }
  );
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errors =
      typeof data === "object" && data !== null && "errors" in data
        ? JSON.stringify((data as { errors: unknown }).errors)
        : "";
    return {
      data,
      error: errors || `HTTP ${response.status}`,
      status: response.status,
    };
  }
  return { data, status: response.status };
};

const callModel = async (
  model: ModelSpec,
  prompt: string,
  dataUrl: string,
  schema: Record<string, unknown>
): Promise<CloudflareCall> => {
  const message = {
    content: [
      { text: prompt, type: "text" },
      { image_url: { url: dataUrl }, type: "image_url" },
    ],
    role: "user",
  };

  // Try structured output first; on 4xx (e.g. unsupported response_format) fall back.
  const attemptConfigs: AttemptConfig[] = [
    { responseFormat: true, thinkingOff: model.supportsThinkingOff },
    { responseFormat: true, thinkingOff: false },
    { responseFormat: false, thinkingOff: false },
  ];

  let lastError: string | undefined;
  let raw: unknown;

  for (const attemptConfig of attemptConfigs) {
    const body: Record<string, unknown> = {
      max_tokens: 4096,
      messages: [message],
      temperature: 0,
    };
    if (attemptConfig.responseFormat) {
      body.response_format = {
        json_schema: { name: "ticket_extraction", schema, strict: true },
        type: "json_schema",
      };
    }
    if (attemptConfig.thinkingOff) {
      body.chat_template_kwargs = { enable_thinking: false };
    }

    let clientError = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // Retry loop: awaits are intentionally sequential (rate-limit backoff).
      // eslint-disable-next-line unicorn/no-await-in-loop
      const { status, data, error } = await callWorkersAI(model.id, body);
      raw = data;
      if (status === 401) {
        // OAuth token expired mid-run — refresh once and retry.
        refreshAndGetToken();
        lastError = error ?? "HTTP 401";
        continue;
      }
      if (status === 429 || status >= 500) {
        lastError = error ?? `HTTP ${status}`;
        // eslint-disable-next-line unicorn/no-await-in-loop
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (status >= 400) {
        // Bad params for this model — fall through to the next attempt config.
        lastError = error ?? `HTTP ${status}`;
        clientError = true;
        break;
      }
      const unwrapped = unwrapEnvelope(data);
      const text = extractText(unwrapped);
      const usage = extractUsage(unwrapped);
      return {
        configUsed: describeConfig(attemptConfig),
        guidedJson: attemptConfig.responseFormat,
        raw: unwrapped,
        text,
        usageIn: usage.in,
        usageOut: usage.out,
      };
    }
    if (!clientError) {
      // Rate-limited/server errors persisted across retries — stop entirely.
      break;
    }
  }

  return {
    configUsed: "none",
    guidedJson: false,
    lastError,
    raw,
    text: undefined,
    usageIn: undefined,
    usageOut: undefined,
  };
};

// ---------------------------------------------------------------------------
// Fixtures + labels
// ---------------------------------------------------------------------------

const labelSchema = z.object({
  displayedResult: z.string().nullable().optional(),
  file: z.string().min(1),
  legs: z
    .array(
      z.object({
        description: z.string().optional(),
        eventDate: z.string().nullable().optional(),
        market: z.string().optional(),
        operator: z.string().optional(),
        secondaryTargetValue: z.number().nullable().optional(),
        subjectName: z.string().min(1),
        subjectType: z.string().optional(),
        targetValue: z.number().nullable().optional(),
      })
    )
    .optional(),
  sourceName: z.string().nullable().optional(),
  ticketType: z.string().optional(),
});

type LabelEntry = z.infer<typeof labelSchema>;

const loadImageFiles = (): string[] => {
  if (!existsSync(IMAGES_DIR)) {
    console.error(`Images directory not found: ${IMAGES_DIR}`);
    console.error(
      "Drop bet-slip screenshots into evals/extraction/fixtures/ first."
    );
    process.exit(1);
  }
  const files = readdirSync(IMAGES_DIR)
    .filter((file) => {
      const ext = file.toLowerCase().slice(file.lastIndexOf("."));
      return ext in MIME_BY_EXT;
    })
    .toSorted();
  if (files.length === 0) {
    console.error(
      `No images (.jpg/.jpeg/.png/.webp/.pdf) found in ${IMAGES_DIR}`
    );
    process.exit(1);
  }
  return files.slice(0, Number.isFinite(LIMIT) ? LIMIT : files.length);
};

const loadLabels = (): Map<string, LabelEntry> => {
  const labels = new Map<string, LabelEntry>();
  // labels.jsonl holds committable ground truth; labels.local.jsonl (gitignored)
  // holds labels for personal real-slip fixtures and overrides on top.
  const labelsPaths = [
    join(SCRIPT_DIR, "fixtures", "labels.jsonl"),
    join(SCRIPT_DIR, "fixtures", "labels.local.jsonl"),
  ];
  for (const labelsPath of labelsPaths) {
    if (!existsSync(labelsPath)) {
      continue;
    }
    for (const [index, line] of readFileSync(labelsPath, "utf-8")
      .split("\n")
      .entries()) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const parsed = labelSchema.safeParse(JSON.parse(trimmed));
      if (parsed.success) {
        labels.set(parsed.data.file, parsed.data);
      } else {
        console.warn(
          `${labelsPath} line ${index + 1} invalid: ${parsed.error.issues[0]?.message}`
        );
      }
    }
  }
  return labels;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface LegMatch {
  expectedIndex: number;
  predictedIndex: number;
  subjectNameOk: boolean;
  subjectTypeOk: boolean;
  marketOk: boolean;
  operatorOk: boolean;
  targetOk: boolean;
  secondaryOk: boolean;
  eventDateOk: boolean | undefined;
}

interface ScoredExtraction {
  expectedLegs: number;
  predictedLegs: number;
  matches: LegMatch[];
  ticketTypeOk: boolean | undefined;
  displayedResultOk: boolean | undefined;
  sourceNameOk: boolean | undefined;
}

const pairLegs = (
  expectedLegs: NonNullable<LabelEntry["legs"]>,
  predictedLegs: ExtractionResult["legs"]
): { i: number; j: number; score: number }[] => {
  const pairs: { i: number; j: number; score: number }[] = [];
  for (const [i, expectedLeg] of expectedLegs.entries()) {
    for (const [j, predictedLeg] of predictedLegs.entries()) {
      let score = similarity(expectedLeg.subjectName, predictedLeg.subjectName);
      if (expectedLeg.description) {
        score = Math.max(
          score,
          similarity(expectedLeg.description, predictedLeg.description) * 0.95
        );
      }
      if (expectedLeg.market && predictedLeg.market) {
        score = Math.max(
          score,
          similarity(expectedLeg.market, predictedLeg.market) * 0.9
        );
      }
      pairs.push({ i, j, score });
    }
  }
  return pairs.toSorted((a, b) => b.score - a.score);
};

const scoreLegMatch = (
  expectedLeg: NonNullable<LabelEntry["legs"]>[number],
  predictedLeg: ExtractionResult["legs"][number]
): Omit<LegMatch, "expectedIndex" | "predictedIndex"> => ({
  eventDateOk:
    EXTENDED && expectedLeg.eventDate !== undefined
      ? normalizeText(expectedLeg.eventDate ?? "") ===
        normalizeText(
          String((predictedLeg as { eventDate?: unknown }).eventDate ?? "")
        )
      : undefined,
  marketOk:
    expectedLeg.market === undefined ||
    normalizeText(expectedLeg.market) === normalizeText(predictedLeg.market) ||
    similarity(expectedLeg.market, predictedLeg.market) >= 0.75,
  operatorOk:
    expectedLeg.operator === undefined ||
    expectedLeg.operator === predictedLeg.operator,
  secondaryOk:
    expectedLeg.secondaryTargetValue === undefined ||
    numbersEqual(
      expectedLeg.secondaryTargetValue,
      predictedLeg.secondaryTargetValue
    ),
  subjectNameOk:
    similarity(expectedLeg.subjectName, predictedLeg.subjectName) >= 0.8,
  subjectTypeOk:
    expectedLeg.subjectType === undefined ||
    expectedLeg.subjectType === predictedLeg.subjectType,
  targetOk:
    expectedLeg.targetValue === undefined ||
    numbersEqual(expectedLeg.targetValue, predictedLeg.targetValue),
});

const scoreTicketLevel = (result: ExtractionResult, expected: LabelEntry) => ({
  displayedResultOk:
    expected.displayedResult === undefined
      ? undefined
      : (expected.displayedResult ?? null) === (result.displayedResult ?? null),
  sourceNameOk:
    expected.sourceName === undefined
      ? undefined
      : similarity(expected.sourceName ?? "", result.sourceName ?? "") >= 0.6,
  ticketTypeOk:
    expected.ticketType === undefined
      ? undefined
      : expected.ticketType === result.ticketType,
});

const scoreAgainstLabels = (
  result: ExtractionResult,
  expected: LabelEntry
): ScoredExtraction => {
  const predictedLegs = result.legs;
  const expectedLegs = expected.legs ?? [];

  const usedExpected = new Set<number>();
  const usedPredicted = new Set<number>();
  const matches: LegMatch[] = [];

  for (const pair of pairLegs(expectedLegs, predictedLegs)) {
    if (
      pair.score < 0.5 ||
      usedExpected.has(pair.i) ||
      usedPredicted.has(pair.j)
    ) {
      continue;
    }
    usedExpected.add(pair.i);
    usedPredicted.add(pair.j);
    const expectedLeg = expectedLegs[pair.i];
    const predictedLeg = predictedLegs[pair.j];
    if (!expectedLeg || !predictedLeg) {
      continue;
    }
    matches.push({
      ...scoreLegMatch(expectedLeg, predictedLeg),
      expectedIndex: pair.i,
      predictedIndex: pair.j,
    });
  }

  return {
    expectedLegs: expectedLegs.length,
    matches,
    predictedLegs: predictedLegs.length,
    ...scoreTicketLevel(result, expected),
  };
};

// ---------------------------------------------------------------------------
// Records + aggregation
// ---------------------------------------------------------------------------

interface CallRecord {
  image: string;
  modelKey: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
  parseOk: boolean;
  schemaOk: boolean;
  guidedJson: boolean;
  configUsed?: string;
  result?: ExtractionResult;
  scored?: ScoredExtraction;
  usageIn?: number;
  usageOut?: number;
  costUsd?: number;
  costEstimated?: boolean;
}

interface ModelAggregate {
  key: string;
  label: string;
  id: string;
  images: number;
  parseRate: number;
  schemaRate: number;
  legRecall: number;
  legPrecision: number;
  subjectNameRate: number | undefined;
  marketRate: number | undefined;
  operatorRate: number | undefined;
  targetRate: number | undefined;
  secondaryRate: number | undefined;
  eventDateRate: number | undefined;
  ticketTypeRate: number | undefined;
  displayedResultRate: number | undefined;
  sourceNameRate: number | undefined;
  avgLatencyMs: number;
  avgCostUsd: number;
  costEstimatedImages: number;
  errors: string[];
}

const rate = (numerator: number, denominator: number): number | undefined =>
  denominator === 0 ? undefined : numerator / denominator;

const pct = (value: number | undefined): string =>
  value === undefined ? "n/a" : `${(value * 100).toFixed(0)}%`;

interface Tallies {
  expectedTotal: number;
  predictedTotal: number;
  matchedTotal: number;
  fieldHits: Record<string, number>;
  fieldDenominator: Record<string, number>;
  ticketHits: Record<string, number>;
  ticketDenominator: Record<string, number>;
}

const createTallies = (): Tallies => ({
  expectedTotal: 0,
  fieldDenominator: {
    eventDate: 0,
    market: 0,
    operator: 0,
    secondary: 0,
    subjectName: 0,
    target: 0,
  },
  fieldHits: {
    eventDate: 0,
    market: 0,
    operator: 0,
    secondary: 0,
    subjectName: 0,
    target: 0,
  },
  matchedTotal: 0,
  predictedTotal: 0,
  ticketDenominator: {
    displayedResult: 0,
    sourceName: 0,
    ticketType: 0,
  },
  ticketHits: { displayedResult: 0, sourceName: 0, ticketType: 0 },
});

const LEG_FIELD_VERDICTS: [string, (match: LegMatch) => boolean][] = [
  ["market", (match) => match.marketOk],
  ["operator", (match) => match.operatorOk],
  ["secondary", (match) => match.secondaryOk],
  ["subjectName", (match) => match.subjectNameOk],
  ["target", (match) => match.targetOk],
];

const tallyVerdict = (
  verdict: boolean | undefined,
  field: string,
  hits: Record<string, number>,
  denominator: Record<string, number>
): void => {
  if (verdict === undefined) {
    return;
  }
  denominator[field] += 1;
  if (verdict) {
    hits[field] += 1;
  }
};

const tallyScores = (
  scoredRecords: ScoredExtraction[],
  tallies: Tallies
): void => {
  for (const scoredData of scoredRecords) {
    tallies.expectedTotal += scoredData.expectedLegs;
    tallies.predictedTotal += scoredData.predictedLegs;
    tallies.matchedTotal += scoredData.matches.length;
    for (const match of scoredData.matches) {
      for (const [field, verdictOf] of LEG_FIELD_VERDICTS) {
        tallyVerdict(
          verdictOf(match),
          field,
          tallies.fieldHits,
          tallies.fieldDenominator
        );
      }
      tallyVerdict(
        match.eventDateOk,
        "eventDate",
        tallies.fieldHits,
        tallies.fieldDenominator
      );
    }
    tallyVerdict(
      scoredData.ticketTypeOk,
      "ticketType",
      tallies.ticketHits,
      tallies.ticketDenominator
    );
    tallyVerdict(
      scoredData.displayedResultOk,
      "displayedResult",
      tallies.ticketHits,
      tallies.ticketDenominator
    );
    tallyVerdict(
      scoredData.sourceNameOk,
      "sourceName",
      tallies.ticketHits,
      tallies.ticketDenominator
    );
  }
};

const aggregate = (
  key: string,
  records: CallRecord[],
  spec?: ModelSpec
): ModelAggregate => {
  const scored = records.filter(
    (record) => record.ok && record.scored !== undefined
  );
  const tallies = createTallies();
  tallyScores(
    scored.flatMap((record) => (record.scored ? [record.scored] : [])),
    tallies
  );

  const latencyRecords = records.filter((record) => record.ok);
  const avgLatencyMs =
    latencyRecords.length === 0
      ? 0
      : latencyRecords.reduce((sum, record) => sum + record.latencyMs, 0) /
        latencyRecords.length;
  const costRecords = records.filter(
    (record) => record.ok && record.costUsd !== undefined
  );
  const avgCostUsd =
    costRecords.length === 0
      ? 0
      : costRecords.reduce((sum, record) => sum + (record.costUsd ?? 0), 0) /
        costRecords.length;

  return {
    avgCostUsd,
    avgLatencyMs,
    costEstimatedImages: costRecords.filter((record) => record.costEstimated)
      .length,
    displayedResultRate: rate(
      tallies.ticketHits.displayedResult,
      tallies.ticketDenominator.displayedResult
    ),
    errors: records
      .filter((record) => !record.ok)
      .map((record) => `${record.image}: ${record.error ?? "unknown"}`),
    eventDateRate: rate(
      tallies.fieldHits.eventDate,
      tallies.fieldDenominator.eventDate
    ),
    id: spec?.id ?? key,
    images: records.length,
    key,
    label: spec?.label ?? key,
    legPrecision:
      rate(tallies.matchedTotal, tallies.predictedTotal) ??
      (tallies.predictedTotal === 0 ? 1 : 0),
    legRecall:
      rate(tallies.matchedTotal, tallies.expectedTotal) ??
      (tallies.expectedTotal === 0 ? 1 : 0),
    marketRate: rate(tallies.fieldHits.market, tallies.fieldDenominator.market),
    operatorRate: rate(
      tallies.fieldHits.operator,
      tallies.fieldDenominator.operator
    ),
    parseRate:
      rate(
        records.filter((record) => record.ok && record.parseOk).length,
        records.length
      ) ?? 0,
    schemaRate:
      rate(
        records.filter((record) => record.ok && record.schemaOk).length,
        records.length
      ) ?? 0,
    secondaryRate: rate(
      tallies.fieldHits.secondary,
      tallies.fieldDenominator.secondary
    ),
    sourceNameRate: rate(
      tallies.ticketHits.sourceName,
      tallies.ticketDenominator.sourceName
    ),
    subjectNameRate: rate(
      tallies.fieldHits.subjectName,
      tallies.fieldDenominator.subjectName
    ),
    targetRate: rate(tallies.fieldHits.target, tallies.fieldDenominator.target),
    ticketTypeRate: rate(
      tallies.ticketHits.ticketType,
      tallies.ticketDenominator.ticketType
    ),
  };
};

// ---------------------------------------------------------------------------
// Qualify (clef-flash image pre-gate prototype)
// ---------------------------------------------------------------------------

const QUALIFY_QUESTIONS = {
  is_betting_slip: {
    instructions:
      "Is this image a sportsbook or betting app bet slip or screenshot showing wagers?",
    type: "noul",
  },
  is_clean_screenshot: {
    instructions:
      "Is this a clean UI screenshot rather than a photo of a screen or an unrelated image?",
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
} as const;

interface QualifyRecord {
  image: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
  answers: Record<string, string>;
  raw?: unknown;
}

const interpretAnswer = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.answer === "string") {
      return record.answer;
    }
    const numericEntries = Object.entries(record).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number"
    );
    if (numericEntries.length > 0) {
      const [topId, topScore] = numericEntries.toSorted(
        (a, b) => b[1] - a[1]
      )[0] ?? ["", 0];
      return `${topId} (${(topScore * 100).toFixed(0)}%)`;
    }
  }
  return JSON.stringify(value);
};

const runQualify = (files: string[]): Promise<QualifyRecord[]> => {
  console.log(`\nQualifying ${files.length} image(s) with clef-flash...`);
  return mapLimit(files, CONCURRENCY, async (file) => {
    const { bytes, mime } = loadFixtureBytes(file);
    const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
    const startedAt = Date.now();
    try {
      const { data, error } = await callWorkersAI("@cf/cloudflare/clef-flash", {
        images: [dataUrl],
        model: "clef-flash",
        questions: QUALIFY_QUESTIONS,
        state:
          "Evaluate the attached image for a sports betting slip processing pipeline.",
      });
      if (error) {
        return {
          answers: {},
          error,
          image: file,
          latencyMs: Date.now() - startedAt,
          ok: false,
        };
      }
      const unwrapped = unwrapEnvelope(data);
      const answersRaw =
        typeof unwrapped === "object" &&
        unwrapped !== null &&
        "answers" in unwrapped
          ? (unwrapped as { answers: Record<string, unknown> }).answers
          : {};
      const answers: Record<string, string> = {};
      for (const [questionId, value] of Object.entries(answersRaw)) {
        answers[questionId] = interpretAnswer(value);
      }
      return {
        answers,
        image: file,
        latencyMs: Date.now() - startedAt,
        ok: true,
        raw: unwrapped,
      };
    } catch (error) {
      return {
        answers: {},
        error: error instanceof Error ? error.message : String(error),
        image: file,
        latencyMs: Date.now() - startedAt,
        ok: false,
      };
    }
  });
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * When the model correctly returns zero legs for a non-slip image (labels with
 * no legs), the production schema's min(1) should not count as a failure.
 * Returns the success record, or undefined if this was a genuine schema error.
 */
const emptyExtractionRecord = ({
  baseRecord,
  call,
  candidate,
  error,
  labelEntry,
  latencyMs,
}: {
  baseRecord: CallRecord;
  call: CloudflareCall;
  candidate: Record<string, unknown>;
  error: unknown;
  labelEntry: LabelEntry | undefined;
  latencyMs: number;
}): CallRecord | undefined => {
  const isEmptyLegsFailure =
    error instanceof z.ZodError &&
    error.issues.length === 1 &&
    error.issues[0]?.path.join(".") === "legs" &&
    error.issues[0].message.includes(">=1") &&
    Array.isArray(candidate.legs) &&
    candidate.legs.length === 0;
  if (!isEmptyLegsFailure || !labelEntry || labelEntry.legs?.length) {
    return undefined;
  }
  const emptyResult = {
    displayedResult: null,
    legs: [],
    sourceName: null,
    ticketType: "single",
  } as unknown as ExtractionResult;
  return {
    ...baseRecord,
    configUsed: call.configUsed,
    guidedJson: call.guidedJson,
    latencyMs,
    ok: true,
    parseOk: true,
    result: emptyResult,
    schemaOk: true,
    scored: scoreAgainstLabels(emptyResult, labelEntry),
    usageIn: call.usageIn,
    usageOut: call.usageOut,
  };
};

const runModelOnImage = async (
  model: ModelSpec | "gemini",
  file: string,
  labels: Map<string, LabelEntry>
): Promise<CallRecord> => {
  const { bytes, mime } = loadFixtureBytes(file);
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  const startedAt = Date.now();
  const baseRecord: CallRecord = {
    guidedJson: false,
    image: file,
    latencyMs: 0,
    modelKey: model === "gemini" ? "gemini" : model.key,
    ok: false,
    parseOk: false,
    schemaOk: false,
  };
  const labelEntry = labels.get(file);

  try {
    if (model === "gemini") {
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
      const { model: usedModel, result } = await extractTicketWithGemini({
        apiKey: geminiApiKey ?? "",
        bytes: arrayBuffer,
        mimeType: mime,
      });
      return {
        ...baseRecord,
        configUsed: `gemini:${usedModel}`,
        guidedJson: true,
        latencyMs: Date.now() - startedAt,
        ok: true,
        parseOk: true,
        result,
        schemaOk: true,
        scored: labelEntry ? scoreAgainstLabels(result, labelEntry) : undefined,
      };
    }

    const call = await callModel(model, activePrompt, dataUrl, activeSchema);
    const { text } = call;
    const latencyMs = Date.now() - startedAt;
    if (!text) {
      return {
        ...baseRecord,
        configUsed: call.configUsed,
        error: call.lastError ?? "model returned no text",
        latencyMs,
        ok: false,
      };
    }
    const parsedJson = tryParseJson(text);
    if (parsedJson === undefined || typeof parsedJson !== "object") {
      return {
        ...baseRecord,
        configUsed: call.configUsed,
        error: "response was not parseable JSON",
        guidedJson: call.guidedJson,
        latencyMs,
        ok: true,
        parseOk: false,
        usageIn: call.usageIn,
        usageOut: call.usageOut,
      };
    }
    let candidate = parsedJson as Record<string, unknown>;
    if (typeof candidate.response === "string") {
      const nested = tryParseJson(candidate.response);
      if (nested && typeof nested === "object") {
        candidate = nested as Record<string, unknown>;
      }
    }
    try {
      const parsedResult = extractionResultSchema.parse(
        candidate
      ) as ExtractionResult;
      const usageIn =
        call.usageIn ??
        Math.ceil((activePrompt.length + dataUrl.length * 0.25) / 4);
      const usageOut = call.usageOut ?? Math.ceil(text.length / 4);
      const costEstimated = call.usageIn === undefined;
      const costUsd =
        (usageIn / 1_000_000) * model.inPerM +
        (usageOut / 1_000_000) * model.outPerM;
      return {
        ...baseRecord,
        configUsed: call.configUsed,
        costEstimated,
        costUsd,
        guidedJson: call.guidedJson,
        latencyMs,
        ok: true,
        parseOk: true,
        result: parsedResult,
        schemaOk: true,
        scored: labelEntry
          ? scoreAgainstLabels(parsedResult, labelEntry)
          : undefined,
        usageIn: call.usageIn,
        usageOut: call.usageOut,
      };
    } catch (error) {
      const issueText =
        error instanceof z.ZodError
          ? error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ")
          : "schema validation failed";
      // Production requires >= 1 leg, but for non-slip fixtures (labels with
      // no legs) an empty extraction is the CORRECT answer — count it as such.
      const emptyRecord = emptyExtractionRecord({
        baseRecord,
        call,
        candidate,
        error,
        labelEntry,
        latencyMs,
      });
      if (emptyRecord) {
        return emptyRecord;
      }
      return {
        ...baseRecord,
        configUsed: call.configUsed,
        error: issueText,
        guidedJson: call.guidedJson,
        latencyMs,
        ok: true,
        parseOk: true,
        schemaOk: false,
        usageIn: call.usageIn,
        usageOut: call.usageOut,
      };
    }
  } catch (error) {
    return {
      ...baseRecord,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
    };
  }
};

const writeRaw = (records: CallRecord[]): void => {
  const rawDir = join(OUT_DIR, "raw");
  mkdirSync(rawDir, { recursive: true });
  for (const record of records) {
    const modelDir = join(rawDir, sanitizeFilename(record.modelKey));
    mkdirSync(modelDir, { recursive: true });
    writeFileSync(
      join(modelDir, `${sanitizeFilename(record.image)}.json`),
      JSON.stringify(record, null, 2)
    );
  }
};

const buildReport = (
  aggregates: ModelAggregate[],
  qualify: QualifyRecord[],
  files: string[]
): string => {
  const lines: string[] = [
    `# Extraction model eval — ${new Date().toISOString()}`,
    "",
    `Images: ${files.length} · Extended schema (eventDate): ${EXTENDED ? "yes" : "no"}`,
    "",
    "| Model | Parse | Schema | Leg recall | Leg precision | Subject | Market | Operator | Value | Ticket type | Avg ms | $/image |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const row of aggregates) {
    lines.push(
      `| ${row.label} | ${pct(row.parseRate)} | ${pct(row.schemaRate)} | ${pct(
        row.legRecall
      )} | ${pct(row.legPrecision)} | ${pct(row.subjectNameRate)} | ${pct(
        row.marketRate
      )} | ${pct(row.operatorRate)} | ${pct(row.targetRate)} | ${pct(
        row.ticketTypeRate
      )} | ${row.avgLatencyMs.toFixed(0)} | ${row.avgCostUsd > 0 ? `$${row.avgCostUsd.toFixed(5)}` : "n/a"} |`
    );
  }
  if (EXTENDED) {
    lines.push(
      "",
      `**eventDate accuracy (extended mode):** ${aggregates.map((row) => `${row.label}: ${pct(row.eventDateRate)}`).join(" · ")}`
    );
  }
  if (qualify.length > 0) {
    lines.push(
      "",
      "## Image qualification (clef-flash)",
      "",
      "| Image | Betting slip | Legible | Settled result | Clean screenshot | ms |",
      "|---|---|---|---|---|---|"
    );
    for (const record of qualify) {
      const answer = (id: string): string =>
        record.ok
          ? (record.answers[id] ?? "?")
          : `error: ${record.error ?? ""}`;
      lines.push(
        `| ${record.image} | ${answer("is_betting_slip")} | ${answer("is_legible")} | ${answer(
          "shows_settled_result"
        )} | ${answer("is_clean_screenshot")} | ${record.latencyMs} |`
      );
    }
  }
  const errorLines = aggregates.flatMap((row) =>
    row.errors.map((error) => `- **${row.label}** ${error}`)
  );
  lines.push(
    ...(errorLines.length > 0 ? ["", "## Errors", "", ...errorLines] : []),
    ""
  );
  return lines.join("\n");
};

const main = async (): Promise<void> => {
  if (!activeAccountId) {
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/accounts",
      {
        headers: { authorization: `Bearer ${apiToken}` },
      }
    );
    const data = (await response.json()) as {
      success: boolean;
      result?: { id: string; name: string }[];
    };
    const first = data.result?.[0];
    if (!data.success || !first) {
      console.error(
        "Could not auto-discover Cloudflare account id. Set CF_ACCOUNT_ID in evals/extraction/.env.local"
      );
      process.exit(1);
    }
    activeAccountId = first.id;
    console.log(`Discovered account ${first.name} (${first.id})`);
  }

  const files = loadImageFiles();
  const labels = loadLabels();
  console.log(
    `Images: ${files.length} · Labels: ${labels.size} · Models: ${SELECTED_MODELS.map((model) => model.key).join(", ")}${geminiApiKey && !NO_BASELINE ? ", gemini (baseline)" : ""}`
  );
  if (labels.size === 0) {
    console.log(
      "No labels.jsonl found — report will be limited to parse/schema/latency/cost metrics."
    );
    console.log(
      "Add ground truth via evals/extraction/fixtures/labels.jsonl.example to score accuracy."
    );
  }

  const includeGemini = Boolean(geminiApiKey) && !NO_BASELINE;
  const runs: { key: string; task: () => Promise<CallRecord> }[] = [];
  for (const file of files) {
    for (const model of SELECTED_MODELS) {
      runs.push({
        key: model.key,
        task: () => runModelOnImage(model, file, labels),
      });
    }
    if (includeGemini) {
      runs.push({
        key: "gemini",
        task: () => runModelOnImage("gemini", file, labels),
      });
    }
  }

  console.log(
    `Running ${runs.length} extraction calls (concurrency ${CONCURRENCY})...\n`
  );
  const records: CallRecord[] = [];
  const statusLabel = (record: CallRecord): string => {
    if (!record.ok) {
      return "error";
    }
    if (!record.parseOk) {
      return "parse-fail";
    }
    return record.schemaOk ? "ok" : "schema-fail";
  };
  await mapLimit(runs, CONCURRENCY, async (run) => {
    const record = await run.task();
    records.push(record);
    console.log(
      `[${record.modelKey}] ${record.image} ${statusLabel(record)} ${record.latencyMs}ms${record.error ? ` — ${record.error.slice(0, 120)}` : ""}`
    );
  });

  const aggregates = [
    ...SELECTED_MODELS.map((model) =>
      aggregate(
        model.key,
        records.filter((record) => record.modelKey === model.key),
        model
      )
    ),
    ...(includeGemini
      ? [
          aggregate(
            "gemini",
            records.filter((record) => record.modelKey === "gemini")
          ),
        ]
      : []),
  ];

  const qualify = QUALIFY ? await runQualify(files) : [];

  mkdirSync(OUT_DIR, { recursive: true });
  writeRaw(records);
  writeFileSync(
    join(OUT_DIR, "summary.json"),
    JSON.stringify(
      {
        aggregates,
        qualify,
        records: records.map(({ result, ...rest }) => ({
          ...rest,
          legCount: result?.legs.length ?? 0,
        })),
      },
      null,
      2
    )
  );
  const report = buildReport(aggregates, qualify, files);
  writeFileSync(join(OUT_DIR, "report.md"), report);
  console.log(`\n${report}`);
  console.log(`Results written to ${OUT_DIR}`);
};

main();
