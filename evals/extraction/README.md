# Extraction Model Eval

Benchmark for bet-slip extraction: compares Workers AI vision models (and the current Gemini baseline) against your stored screenshots, and prototypes the cheap `clef-flash` image-qualification gate.

## 1. Setup

Create `evals/extraction/.env.local` (gitignored):

```bash
CF_ACCOUNT_ID=your_account_id
CF_API_TOKEN=an_api_token_with_workers_ai_edit_permission
# optional — enables the Gemini baseline for comparison:
GEMINI_API_KEY=your_key
```

Get the account id and token at <https://dash.cloudflare.com/profile/api-tokens>. If `CF_ACCOUNT_ID` is omitted, it is auto-discovered via the API token. `GEMINI_API_KEY` is also read from `apps/server/.dev.vars` if it exists there.

## 2. Add images

Drop bet-slip screenshots into `evals/extraction/fixtures/` — `.jpg`, `.jpeg`, `.png`, `.webp`, or `.pdf` (PDFs are auto-converted to PNG on first use, page 1). Same guidance as the app's upload tips: full slip in frame, readable text, one ticket per image.

**Privacy note:** this repo is **public** — real slips contain personal betting history. Files matching `IMG_*` and `labels.local.jsonl` are gitignored on purpose: drop your real screenshots in locally (they'll run in the eval but stay out of git), and put their hand-written ground truth in `fixtures/labels.local.jsonl`, which the harness merges over `labels.jsonl`. Only synthetic fixtures and their labels are committed.

Or generate a synthetic suite:

```bash
bun evals/extraction/generate-fixtures
```

This renders 11 realistic fake slips (FanDuel/DraftKings/PrizePicks/etc.) with headless Chrome — covering active parlays, same-game parlays, settled won/lost tickets, day-of slates, teasers, a **mixed past/future parlay**, and two negative controls (a non-slip document and an odds board, which should yield zero legs). It also writes exact ground-truth `labels.jsonl` entries for everything it generates. Requires Chrome in /Applications. Manual entries for other images are preserved when regenerating.

Optionally add ground truth for your real screenshots as `fixtures/labels.jsonl` (copy `labels.jsonl.example`). With labels you get leg-level recall/precision and field accuracy; without them you still get parse rate, schema conformance, latency, and cost.

## 3. Run

```bash
bun run eval:extraction
```

Useful flags:

```bash
bun run eval:extraction -- --models gemma4,llama4scout   # subset of models
bun run eval:extraction -- --limit 5                     # first 5 images only
bun run eval:extraction -- --extended                    # adds eventDate to the schema
bun run eval:extraction -- --qualify                     # clef-flash image gate
bun run eval:extraction -- --concurrency 4               # parallel calls
bun run eval:extraction -- --no-baseline                 # skip Gemini even if key exists
```

Model keys: `gemma4`, `llama4scout`, `qwen38`, `llama32vision`, `glm53flash`.

## 4. Output

Results land in `evals/extraction/results/<timestamp>/`:

- `report.md` — the summary table, printed to the console too
- `summary.json` — machine-readable aggregates + per-call records
- `raw/<model>/<image>.json` — full request config, raw response, and parsed result per call (for inspecting exactly what each model said)

## Models and pricing

| Key | Model | In $/M | Out $/M | Notes |
| --- | --- | --- | --- | --- |
| `gemma4` | `@cf/google/gemma-4-26b-a4b` | 0.10 | 0.30 | **Production extraction model** |
| `llama4scout` | `@cf/meta/llama-4-scout-17b-16e-instruct` | 0.27 | 0.85 | Native multimodal MoE |
| `qwen38` | `@cf/qwen/qwen3.8` | 0.45 | 3.20 | Strong VLM, priciest output |
| `llama32vision` | `@cf/meta/llama-3.2-11b-vision-instruct` | 0.049 | 0.676 | Cheap baseline (needs one-time `agree`) |
| `glm53flash` | `@cf/zai-org/glm-5.3-flash` | 0.15 | 0.50 | Requires Workers paid plan or credits |
| `gemini` (baseline) | `gemini-3.8-flash` (former prod) | — | — | Runs only when `GEMINI_API_KEY` is set |

All Workers AI usage bills to your account, so this consumes your startup credits — a full run with a few dozen images costs pennies. The prompt and JSON schema are imported from `apps/server/src/services/extraction-prompt.ts` — the same single source of truth production uses — so this benchmark always measures exactly what the Worker sends. The Gemini baseline lives in `gemini-baseline.ts` (eval-only; production extraction runs on Workers AI via `services/workers-ai.ts` with a clef-flash pre-gate).

## Notes

- The harness sends the **exact production prompt and JSON schema** from `apps/server/src/services/gemini.ts`, so results are directly comparable to the baseline.
- Structured output: requests use `response_format: json_schema` first and fall back to plain prompting if a model rejects it; the report's raw files record which mode each call used.
- `--extended` adds an `eventDate` field per leg, to test whether models can read visible event dates — the input needed for past/future ticket routing.
- `--qualify` runs `@cf/cloudflare/clef-flash` per image (a few ms and a tiny fraction of a cent each) answering: is it a betting slip, is it legible, does it show a settled result, is it a clean screenshot. This is the prototype for a production upload pre-gate.
