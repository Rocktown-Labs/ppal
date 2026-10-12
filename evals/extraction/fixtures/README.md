# Fixtures

Drop bet-slip screenshots here (`.jpg`, `.jpeg`, `.png`, `.webp`).

Guidance for good eval images:

- One ticket per image, full slip in frame
- Include a mix: single bets, parlays, same-game parlays, PrizePicks-style entries, settled tickets with won/lost badges, and edge cases (low light, cropped edges, multi-part scroll screenshots)
- Name files descriptively, e.g. `fanduel-parlay-2026-10-04.jpg`

## Ground truth (optional but recommended)

Copy `labels.jsonl.example` to `labels.jsonl` and fill in one JSON object per image. Fields:

- `file` — the image filename (required)
- `sourceName` — sportsbook name as shown
- `ticketType` — `parlay | single | sgp | teaser | round_robin`
- `displayedResult` — `won | lost | push | void` or `null`
- `legs[]` — each selection you know is on the slip:
  - `subjectName` (required), `subjectType` (`player|team|game`)
  - `market` — the closest supported slug (see the list in the report's source)
  - `operator` (`over|under|gte|lte|equals|moneyline|spread|yes|no|custom`)
  - `targetValue`, `secondaryTargetValue` (for ranges)
  - `description` — wording on the slip (helps fuzzy matching)
  - `eventDate` — `YYYY-MM-DD` if you know it (used with `--extended`)

Partial labels are fine — leave out what you can't verify; the scorer only uses fields you provide.
