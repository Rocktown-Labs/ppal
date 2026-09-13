# Intelligent Ticket Extraction, Live Tracking, and Notification Plan

## Executive decision

ParlayPal should treat a bet slip as an executable tracking specification, not as a collection of labels. The extraction system must translate every leg into a canonical market definition that answers five questions:

1. **Who or what is being measured?** A player, team, game, fight, race, round, set, tournament, or group.
2. **What observation settles it?** A score, statistic, rank, event occurrence, elapsed time, or formula over several statistics.
3. **What is the comparison?** Over, under, at least, exact, yes/no, moneyline, spread, range, rank, or multi-outcome selection.
4. **What time and rule scope applies?** Full game, regulation only, including overtime, quarter, half, inning, set, round, tournament, or “rest of match.”
5. **Can the live-data provider observe it accurately?** If not, the app must mark it unsupported or final-only instead of pretending it can track it live.

This change separates four jobs that are currently mixed together:

```text
Uploaded ticket
    → evidence extraction
    → canonical bet compiler
    → entity/event resolution and support validation
    → live observation ingestion
    → market evaluation
    → notification decision engine
    → in-app, mobile push, web push, and email delivery
```

The first production-quality vertical slice should be **NFL and NCAA football**, because those leagues are active now. It includes moneyline, spread, game and team totals, passing/rushing/receiving yards, passing/rushing/receiving touchdowns, receptions, field goals, sacks, interceptions, anytime/first touchdown, quarter/half markets, and common additive player combinations. Basketball remains fully designed and implemented against the same contracts so it is ready before NBA, WNBA, and NCAA basketball schedules become active.

All 18 Sportradar products already configured in the repository are in scope now. “Football first” controls release priority, not architecture scope: every product gets a provider manifest, endpoint strategy, capability mapping, normalizer contract, trial cadence, production cadence, and replay fixture as part of this program.

## What notifications a moneyline bet should send

A moneyline leg is not “won” or “lost” until the applicable game scope is final. During play, it should report the selected team’s live position without presenting a temporary lead as a win.

At the user’s selected **5-, 10-, or 15-minute interval**, the system should send one summary when something relevant changed:

- **Game start:** `Suns moneyline is live — Suns 0, Nuggets 0.`
- **Interval score summary:** latest score, lead/tie/trail state, period, and clock. Example: `Suns 82–79 Nuggets — Q3, 2:14. Phoenix leads by 3.`
- **Boundaries crossed during the interval:** quarter for basketball/football, period for hockey, half for soccer, and relevant inning checkpoints for baseball. Example: `Q3 ended 84–82; Q4 now 91–88 Suns.`
- **Meaningful changes during the interval:** lead changes, ties, largest margin movement, late-game state, and any settlement-critical event, summarized rather than sent individually.
- **Final settlement:** `Won: Suns moneyline — Phoenix beat Denver 112–108.` or `Lost: Suns moneyline — Denver won 112–108.`
- **Exceptional settlement:** push, void, postponement, cancellation, suspension, or provider-tracking failure when it materially affects the leg.

The app does not send each score or stat change immediately. It keeps a watermark for the previous notification window, processes all new plays since that watermark, and sends the latest state plus the most important changes. A final result is included in the next due interval, so maximum notification delay matches the user’s selected cadence.

Moneyline scope must be explicit. A two-way moneyline commonly includes overtime, while a three-way moneyline generally settles at the end of regulation; DraftKings’ general rules make this distinction explicit.[^20] The extracted market therefore cannot be represented by only `operator = moneyline`.

## Notification behavior by market family

| Market family | Live value shown | Interval summary contents | When it may settle |
| --- | --- | --- | --- |
| Player discrete count: 3PM, goals, assists, TDs, HRs, aces, strikeouts | Current count, interval delta, and target | One interval summary listing increments and milestones crossed | Over can become provisionally complete when crossed; under waits for final scope |
| Player cumulative volume: points, PRA, yards, shots, significant strikes | Aggregate, changed components, and target | One interval summary with total change and important component changes | Over may become provisionally complete when crossed; under waits for final scope |
| Moneyline | Selected score, opponent score, lead/tie/trail, period and clock | Latest interval state plus lead/tie and boundary history | Applicable final boundary only |
| Spread | Current margin, spread-adjusted margin, cover/not-cover | Interval state plus cover-line crossings and boundaries | Final boundary only |
| Game/team total | Current total and target, pace optional | Interval state, scoring delta, milestones, and boundaries | Over may cross early; under waits for final scope |
| Exact score or exact statistic | Current value and required value | Interval checkpoints and final | Final boundary only unless outcome becomes impossible |
| Yes/no occurrence: anytime TD, HR, tiebreak, clean sheet | Occurred/not occurred | Report occurrence or reversal in the next interval summary | Yes may complete on occurrence; No waits for final |
| Rank/finish: top 10, race winner, tournament winner | Current rank and tie state | Interval rank movement, round/stage boundaries, and final | Official final result; dead heat may alter payout |
| Period/segment: quarter, half, inning, set, round | Segment-local value | Summarize any starts/ends crossed during the interval | End of that segment, with market-specific overtime rules |
| Multi-selection/parlay | Won/live/pending/void counts and key live legs | One ticket-level interval digest with all changed legs | According to ticket type and void/repricing rules |

### Required user-selectable frequency

Notification cadence is selected per ticket as **5 minutes**, **10 minutes**, or **15 minutes**. Notifications may also be disabled. Channel selection remains independent: the same due summary can be written in-app and delivered through mobile push, web push, or email according to user preferences.

If several users track the same event at different cadences, provider polling follows the shortest active cadence. Each user’s delivery watermark follows their own selection: a five-minute subscriber can receive every fetch window, while a fifteen-minute subscriber receives every third window as one cumulative summary. Quiet hours, per-ticket overrides, and a single-ticket mute remain necessary.

## Canonical bet model

The current extraction contract captures a description, market slug, optional additive components, operator, target, sport, league, and subject. It does not preserve enough information to distinguish markets that look similar but settle differently.

### Ticket-level fields

```ts
interface CanonicalTicket {
  sportsbook: "draftkings" | "fanduel" | "betmgm" | "unknown";
  sportsbookTicketId: string | null;
  wagerKind:
    | "single"
    | "parlay"
    | "same_game_parlay"
    | "teaser"
    | "round_robin"
    | "progressive_parlay";
  placedAt: string | null;
  placementContext: "pregame" | "live" | "unknown";
  stake: Money | null;
  odds: Odds | null;
  potentialPayout: Money | null;
  boost: PromotionAdjustment | null;
  ruleProfile: { sportsbook: string; version: string };
  sourceEvidence: TicketEvidence;
}
```

Odds should preserve the displayed American, decimal, or fractional value and also normalize to decimal odds and implied probability. DraftKings describes all three formats and notes that conversions and parlay rounding can differ slightly from final sportsbook payouts.[^9][^11][^12] The screenshot’s potential payout remains authoritative display evidence; ParlayPal should not claim its recomputation is the sportsbook’s settlement amount.

`placementContext` matters because live-bet lines and prices change during the event; the system must preserve the accepted line from the ticket rather than looking up the current market.[^10]

### Leg-level fields

```ts
interface CanonicalLeg {
  sourceText: string;
  selection: EntityRef | OutcomeRef;
  event: EventRef;
  marketFamily: MarketFamily;
  metric: MetricExpression;
  comparison: ComparisonExpression;
  scope: TimeScope;
  overtimePolicy: "include" | "exclude" | "market_rule";
  participationRule: ParticipationRule;
  settlementRule: SettlementRule;
  odds: Odds | null;
  evidence: FieldEvidence[];
  confidenceByField: Record<string, number>;
  supportLevel: "live" | "checkpoint" | "final_only" | "unsupported";
  resolutionStatus: "resolved" | "ambiguous" | "not_found";
}
```

`confidenceByField` is more useful than one confidence score. A ticket can have a clearly readable player name but an uncertain decimal point, period label, or over/under direction. Any low-confidence field that changes settlement must force review.

### Metric expression instead of a flat market slug

An expression tree generalizes simple, combined, segmented, and event-occurrence markets:

```ts
type MetricExpression =
  | { kind: "stat"; subject: EntityRef; stat: StatKey }
  | { kind: "sum"; terms: MetricExpression[] }
  | { kind: "score"; team: EntityRef }
  | { kind: "margin"; team: EntityRef; opponent: EntityRef }
  | { kind: "event_count"; subject: EntityRef; event: EventType }
  | { kind: "occurred"; event: EventPredicate }
  | { kind: "rank"; subject: EntityRef }
  | { kind: "elapsed_time"; event: EntityRef }
  | { kind: "segment"; scope: TimeScope; expression: MetricExpression };
```

Examples:

```ts
// Kevin Durant over 3.5 made threes
compare(stat(durant, "three_pointers_made"), ">", 3.5);

// LeBron James over 29.5 points + rebounds + assists
compare(
  sum([
    stat(lebron, "points"),
    stat(lebron, "rebounds"),
    stat(lebron, "assists"),
  ]),
  ">",
  29.5
);

// Phoenix +3.5 full-game spread
compare(sum([margin(phoenix, denver), constant(3.5)]), ">", 0);

// First-half player points
compare(segment(firstHalf, stat(player, "points")), ">", 12.5);
```

This replaces special-case growth of `marketComponents`. Additive components remain easy, while rank, occurrence, range, timing, opponent comparison, and segment scope become representable.

## Extraction should be a compiler pipeline

### 1. Preserve visual evidence

Store the original image privately, a normalized image rendition, OCR text, and per-field bounding boxes or polygons. Redact account identifiers in derived images. Every extracted value shown for review should be traceable to its location on the ticket.

### 2. Detect the sportsbook and template

Run a deterministic DraftKings adapter before the generic vision-language extraction. Detect stable labels, section order, typography, ticket type, odds format, stake, payout, SGP grouping, boosts, and leg boundaries. The vision model should handle OCR ambiguity and layout variation, but sportsbook adapters should define the expected grammar.

### 3. Produce raw candidates, not final database rows

The model emits source-faithful candidates with confidence per field. It must not invent a canonical market slug when text is missing. Preserve the exact source string, including words such as “1st half,” “60 min,” “incl. OT,” “3-way,” “to record,” “alt,” “live,” and “rest of match.”

### 4. Compile candidates against a versioned market catalog

The catalog maps sportsbook wording to canonical semantics:

```text
sportsbook phrase
  + sport/league
  + ticket context
  → market family
  + metric expression
  + time scope
  + settlement rule
  + provider capability
```

Catalog entries must be versioned because sportsbooks change labels and rules. The ticket stores the rule-profile version used at placement/review.

### 5. Resolve entities and events

Resolve player/team aliases, scheduled start time, opponents, competition, and provider IDs. Use the ticket date and event pairing to distinguish duplicate names. Do not silently select the first fuzzy match. Ambiguous events, players, or teams require review.

### 6. Validate semantic completeness and trackability

A leg cannot enter live tracking until all settlement-critical fields are known. Separately record whether it supports live event-level tracking, checkpoint tracking, final-only settlement, or no reliable tracking. This avoids the dangerous state where the UI promises alerts for a market the feed cannot observe.

### 7. Human review should focus on uncertainty

Highlight only fields that are low-confidence, unresolved, unsupported, or internally inconsistent. Show the original crop next to the editable canonical interpretation. A corrected review becomes labeled training/evaluation data for the relevant sportsbook template.

## Live-data and evaluation architecture

### Trial, production REST, and production push are runtime profiles

Sportradar trial access currently defaults to a 30-day trial, 1,000 requests per API product per rolling 30 days, and 1 query per second. The trial receives the same real-world data and update frequency as production in normal cases; the key difference is the lower request allowance. Push feeds generally require a sales-assisted entitlement rather than a self-issued trial.[^26]

The application must not hardcode `/trial/` into endpoint paths as it does today. Each provider product receives a runtime entitlement profile:

```ts
interface ProviderEntitlement {
  product: SportradarProduct;
  accessLevel: "trial" | "production";
  transport: "rest" | "push";
  rollingQuota: number | null;
  rollingWindowSeconds: number | null;
  qps: number;
  enabledEndpoints: EndpointCapability[];
  pushEntitled: boolean;
  mode: "trial_rest" | "production_rest" | "production_push";
}
```

The rest of the system consumes canonical observations and is unaware of the access level. Moving to production changes configuration and transport, not extraction semantics, evaluators, or notification templates.

#### Trial operating policy

At 1,000 calls per rolling 30 days, a three-hour football game costs only 36 scheduled calls at a five-minute cadence, 18 at ten minutes, or 12 at fifteen minutes, plus discovery and final reconciliation. This makes the product cadence a major quota advantage. Trial mode should:

1. Fetch only events referenced by confirmed tickets; never poll every scheduled event.
2. Stop the current twice-daily, all-product schedule sweep. Resolve schedules on demand from the extracted league/date/team hints and cache the result.
3. Reserve calls for start detection, active interval tracking, final reconciliation, and error recovery.
4. Deduplicate one provider fetch across every ticket and user following the same event.
5. Prefer aggregate live endpoints when one call returns several tracked active events for a product; otherwise use the event-specific cumulative timeline/play-by-play feed.
6. Use `Cache-Control`, event status, coverage flags, and detected changes to choose the next request time.
7. Expose freshness honestly: `Live`, `Updated 42s ago`, `Checkpoint tracking`, or `Final-only`.
8. If quota cannot honor the selected cadence, clearly mark tracking as quota-limited and ask the user to choose a longer interval; never silently claim five-minute freshness or fabricate a live value.

Provide three trial presets per product:

| User interval | Approximate calls for a three-hour event | Use |
| --- | --: | --- |
| 5 minutes | 36 plus discovery/final overhead | Most frequent supported updates |
| 10 minutes | 18 plus discovery/final overhead | Balanced freshness and quota |
| 15 minutes | 12 plus discovery/final overhead | Maximum trial efficiency |

Admission control is computed before tracking begins from remaining quota, time until the rolling window releases calls, number and expected duration of active tracked events, shortest requested cadence, and reserved finalization budget. Once accepted, the scheduler should honor that cadence or visibly declare degradation.

#### Production REST policy

Poll only subscribed events at the shortest active 5-, 10-, or 15-minute user cadence. Football, basketball, baseball, and NHL game play-by-play feeds generally move to a three-second cache while in progress; that means fresh data is available when the interval poll arrives, not that ParlayPal needs to request it every three seconds.[^27][^28][^29][^30] Read the response cache headers, use cumulative play-by-play/timeline feeds, and use change logs for post-final corrections where supported.

#### Production push policy

Push is optional rather than required for the 5–15 minute product promise. When a push package is entitled, a dedicated transport may ingest event/statistic payloads continuously and reduce REST polling, but it still emits interval summaries on the user’s schedule. It uses REST play-by-play for reconnect recovery and final reconciliation because push sessions are not stateful.[^25] The push and REST transports emit the same `ObservationEnvelope`.

### Cloudflare target topology

```text
Upload/API Worker
  ├─ R2: private slips and evidence
  ├─ D1: tickets, canonical legs, subscriptions, policy, current state
  └─ Extraction Queue → extraction/compiler Worker

Confirmed trackable leg
  → Event Registry
  → D1 tracking schedule (next_poll_at = shortest active user interval)
  → Minute Cron claims due events and groups compatible requests
  → Product Budget Durable Object
       ├─ one object per Sportradar product
       ├─ enforces QPS, rolling quota, reservations, and backoff
       └─ chooses event-specific vs aggregate-live endpoint

Provider response
  → R2 raw payload archive
  → Observation Queue
  → sport normalizer → canonical facts
  → expression evaluator → ProgressDelta
  → Notification Candidate Queue
  → policy/coalescing → D1 notification + delivery queue
  → in-app / Expo push / Web Push / email
```

The 5–15 minute cadence means the existing minute Cron, D1 `next_poll_at`, and sports Queue are sufficient for event scheduling; a Durable Object per event would add complexity without useful freshness. Only one Product Budget Durable Object per Sportradar product is justified, because it serializes quota and QPS decisions across concurrent events. If the product later promises sub-minute delivery, per-event alarms remain an available extension rather than a current requirement.[^42][^43]

Cloudflare Queues remain the durable fan-out mechanism. They provide at-least-once delivery and do not guarantee order, requiring the provider sequence/revision keys already proposed here.[^44] Delayed messages handle 429 backoff and deferred retries for up to 24 hours.[^45] D1 remains the relational source of truth; large raw payloads and replay corpora belong in R2. Analytics Engine should capture calls granted/denied, quota remaining, cache TTL, payload changes, observation lag, evaluator latency, candidates suppressed, and delivery outcomes.

Workflows are not part of the hot live-event loop. They are useful for bounded offline jobs such as rebuilding a golden replay corpus, bulk recompilation after a catalog version change, or a human-review workflow, but Queues plus Durable Object alarms are the simpler and more controllable live path.

### Observation envelope

All sport adapters should emit a common append-only envelope:

```ts
interface ObservationEnvelope {
  provider: string;
  providerEventId: string;
  providerSequence: string;
  observedAt: string;
  effectiveAt: string | null;
  revision: number;
  operation: "insert" | "update" | "delete";
  gameState: {
    status: EventStatus;
    period: string | null;
    clock: string | null;
    homeScore: number | null;
    awayScore: number | null;
  };
  facts: CanonicalFact[];
  rawPayloadRef: string;
}
```

Provider updates can be duplicated, delayed, delivered out of order, or corrected. Persist provider sequence/version and operation semantics, then recalculate affected metrics. A correction may lower a player’s rebound total or delete a scoring play, so “increasing” stats are not strictly monotonic before official settlement.

### Event ingestion once, evaluation many times

The current shared-event polling invariant is good: one provider fetch should serve every ticket tracking that event. Retain that model, but index subscriptions by the exact facts they depend on:

```text
event + participant/team + stat/event type + scope → affected leg IDs
```

Only dependent expressions need reevaluation after each observation. Persist both the raw observation and the resulting metric snapshot so notification decisions are auditable.

### Cumulative play-by-play plus reconciliation

The existing summary-only polling cannot explain which plays or PRA components changed. It does not need to poll continuously, however. Sportradar’s NBA play-by-play contains the game event history and is described as real-time with a three-second in-progress cache.[^23] At each 5–15 minute interval, ParlayPal fetches the cumulative play-by-play/timeline, applies only events after its stored watermark, calculates every affected metric, and creates one interval digest. Sportradar Push Events remains an optional transport for entitled production accounts.[^24]

Recommended NBA strategy:

1. Schedule one fetch per tracked event at the shortest active user cadence.
2. Fetch the cumulative play-by-play/timeline and apply insert/update/delete changes after the stored watermark.
3. Recalculate all dependent player, team, game, and ticket expressions.
4. Build per-user summaries from changes since each user’s notification watermark.
5. Reconcile against the official summary at final/closed status and through supported post-final change logs.
6. Delay irreversible settlement language until the sportsbook-relevant result is definitive.

Use a full event timeline rather than a delta-only endpoint when the provider does not guarantee that a delta window remains available for at least 15 minutes. If neither cumulative event history nor sufficient current statistics are available, the manifest must downgrade that market to checkpoint/final-only.

### Progress delta

Evaluation should emit a rich delta instead of only a changed status:

```ts
interface ProgressDelta {
  legId: string;
  previous: MetricSnapshot | null;
  current: MetricSnapshot;
  changedComponents: Array<{ key: StatKey; from: number; to: number }>;
  progressPercent: number | null;
  liveState: "ahead" | "behind" | "tied" | "on_pace" | "off_pace" | null;
  settlement:
    "unsettled" | "provisional_win" | "won" | "lost" | "push" | "void";
  trigger:
    "stat_change" | "score_change" | "period_end" | "final" | "correction";
}
```

The notification decision engine—not the evaluator—decides whether that delta becomes an in-app event, push, web push, or email.

## Exact football experiences

Football progress should be play-aware, not merely boxscore-aware. A play can change several related facts—quarterback passing yards, receiver receptions/yards, team score, spread, total, and multiple parlay legs—so the system evaluates all affected expressions from one canonical play and then coalesces notifications by ticket.

### NFL or NCAA player passing yards over 249.5

```text
Kickoff       Jalen Hurts passing yards is live — 0/250.
5-min update  Jalen Hurts passing — 87/250 • Q1 1:42 • +87 this window.
5-min update  Jalen Hurts passing — 171/250 • Q2 4:08 • +84; long play 42.
5-min update  Halftime: 188/250 passing yards • +17 this window.
5-min update  Jalen Hurts passing — 238/250 • Q4 11:13 • 12 needed.
5-min update  Target reached: 254/250 • Q4 8:51 • crossed this window.
Next interval Won: Over 249.5 passing yards — final 267.
```

The interval summary should not list every short completion. It reports the net yardage change, largest play, milestones crossed, quarter/half boundaries, near-target state, target crossing, and final state that occurred since the previous delivery.

### Anytime touchdown

```text
Kickoff       Saquon Barkley anytime TD is live.
5-min update  Hit: Saquon Barkley scored a 12-yard rushing TD • Q2 6:18.
Next interval Won: Saquon Barkley anytime touchdown — final.
```

The canonical scoring event must identify scorer, scoring type, nullification/review state, and provider revision. A touchdown reversed by replay must retract provisional completion and send a correction if the user already received the alert.

### Football moneyline, spread, and total

- Moneyline: latest score plus any lead/tie change, quarter end, halftime, two-minute warning, overtime start, and final crossed during the window.
- Spread: latest adjusted margin plus cover-line crossings, quarter/half boundaries, late-game changes, and final crossed during the window.
- Total: latest total plus scoring change, milestones, halftime, fourth-quarter proximity to the line, target crossing, and final crossed during the window.

One touchdown can produce a single ticket-level push: `Eagles parlay update — Barkley TD hit; Eagles -3.5 now covering; total 31/47.5.` The underlying leg updates remain individually auditable.

## Exact basketball experiences

### Kevin Durant over 3.5 three-pointers made

Canonical meaning is `three_pointers_made > 3.5`, equivalent to four or more makes over the extracted game scope.

Suggested timeline:

```text
Game start    Kevin Durant 3PM is live — 0/4.
5-min update  Kevin Durant 3PM — 1/4 • Q1 8:42 • +1 this window.
5-min update  Kevin Durant 3PM — 3/4 • Q2 5:11 • +2 this window; one more.
5-min update  Hit: Kevin Durant over 3.5 3PM — 4/4 • Q4 9:18.
Next interval Won: Kevin Durant over 3.5 3PM — final 4.
```

The fourth make may be shown as **hit/provisional**, because official-stat corrections and sportsbook rules can still affect settlement. Final wording should distinguish “target reached” from “sportsbook settled.”

### LeBron James over 29.5 points + rebounds + assists

Store both the aggregate and components. A message should explain the change:

```text
LeBron James PRA — 22/30 • Q3 4:21
16 PTS + 4 REB + 2 AST; +2 points since the last update.
```

The selected interval naturally coalesces rapid sequences. If several baskets, rebounds, and assists occur, send one update such as `LeBron PRA 25/30 — +7 PTS, +2 REB, +1 AST in the last 5 minutes.` The underlying observations remain available for evaluation and audit.

### Suns moneyline

```text
Start         Suns moneyline is live — PHX 0, DEN 0.
5-min update  Suns 54–53 Nuggets • Q2 0:48 — two lead changes this window.
5-min update  Suns 91–88 Nuggets • Q4 7:26 — Q3 ended 84–82.
5-min update  Suns 101–103 Nuggets • Q4 1:02 — Phoenix moved behind.
Next interval Won/Lost: Suns moneyline — final score and applicable scope.
```

For an NBA full-game bet, overtime inclusion and player participation rules come from the applicable sportsbook rule profile, not from generic basketball assumptions. DraftKings’ basketball rules include overtime for most markets but list explicit exceptions, including three-way moneyline and fourth-quarter player points.[^21]

## Sport and market support map

The supplied DraftKings guides demonstrate that one flat cross-sport market list will not be sufficient.[^1][^4][^5][^6][^15][^16][^17][^18][^19]

| Sport | Core ticket shapes to recognize | Required live facts | Important semantic traps |
| --- | --- | --- | --- |
| Basketball | Moneyline, spread, totals, player stats, PRA and other sums, period props, SGP, futures | Plays, score, period/clock, player boxscore and revisions | Overtime exceptions, quarter participation, field goal vs free throw, injury/participation void rules |
| Football | Moneyline, spread, totals, passing/rushing/receiving, TD occurrence, drive/quarter/half, teasers, SGP | Plays/drives, score, period/clock, player/team stats | Overtime scope, shared sacks, defensive/special-teams definitions, player participation |
| Baseball | Moneyline, run line, totals, first five innings, team totals, H+R+E, HR, strikeouts, stolen bases, inning markets | Pitches/plate appearances, inning/half, outs, score, batting/pitching stats | Listed pitchers, shortened games, first-five scope, official scoring corrections |
| Hockey | Moneyline, puck line, totals, 60-minute three-way, player shots/goals/assists, grand salami | Events, score, period/clock, skater/goalie stats | Regulation vs overtime/shootout, goalie participation, multi-game grand salami |
| Soccer | Three-way result, handicap, totals, correct score, HT/FT, shots on target, scorer/assist, draw-no-bet, Asian handicap, double chance, clean sheet, corners | Timeline, score, period/time, player events, cards/corners | Regulation plus stoppage vs extra time, split Asian lines, substitute participation, own goals/cards definitions |
| Tennis | Match winner, game handicap, total games, exact set score, first-set/match result, aces, tiebreak, win-a-set | Point/game/set timeline and player stats | Retirement/walkover, best-of format, match-tiebreak treatment, surface/tournament identity |
| Golf | Outright, top-N, round leader, head-to-head/group, nationality, hole/round/tournament props | Leaderboard, hole/round status, score, rank, ties | Cuts, withdrawals, dead-heat payout, tied ranks, tournament shortening |
| MMA | Fighter moneyline, round total, method, time of finish, significant strikes, knockdowns, takedowns, SGP | Fight clock/round, official result, event statistics | Half-round means elapsed time, no contest/technical decision, overturned results, live-SGP repricing |
| NASCAR | Race winner, top finisher, fastest lap, laps led, team/race props, cautions, lead changes | Lap, running order, stage/race status, incidents and official result | Post-race inspection, stage vs race, driver substitution, official classification |

Roll out each row only after a market-to-provider capability matrix is complete. “Extractable” and “trackable” are separate product states.

### Complete Sportradar product manifest

Every configured product receives a manifest in code rather than scattered endpoint string conditionals. The manifest contains product/access path builders, supported transports, discovery endpoint, live endpoint, reconciliation endpoint, change-log endpoint, coverage parser, identity namespace, cache-header parser, normalizer version, and quota bucket.

| Repository product | Preferred live feed | Canonical facts produced | Live market capability |
| --- | --- | --- | --- |
| NFL v7 | Game play-by-play; game statistics/boxscore for reconciliation | Play/drive, possession, down/distance, score, quarter/clock, player passing/rushing/receiving/defense/kicking | Team outcomes/totals; player yards, attempts, completions, receptions, TDs, field goals, interceptions, sacks; quarter/half and occurrence props |
| NCAA Football v7 | Game play-by-play; game statistics/boxscore | Same football fact model, with coverage and `expected_latency` recorded | Same semantic families as NFL only where the game’s coverage exposes the required stat; unavailable NCAA-specific stats become checkpoint/final-only |
| NBA v8 | Game play-by-play; summary reconciliation | Shot/rebound/assist/turnover/foul, score, quarter/clock, player/team totals | Moneyline/spread/totals, core player stats, 3PM, PRA and additive combinations, period props |
| WNBA v8 | Game play-by-play; summary reconciliation | Same basketball fact model | Same as NBA, gated by actual event coverage |
| NCAA Men’s Basketball v8 | Game play-by-play; summary reconciliation | Same basketball fact model with half/period format | Team outcomes/totals, core player props where player coverage is present, half markets |
| NCAA Women’s Basketball v8 | Game play-by-play; summary reconciliation | Same basketball fact model with competition-specific periods | Same capability-gated basketball families |
| MLB v8 | Game play-by-play/event tracking; boxscore/summary reconciliation | Pitch, plate appearance, hit/run/error, inning/half/outs, score, batter/pitcher stats | Moneyline/run line/totals, first five, team totals, hits/runs/RBI/HR/strikeouts/stolen bases, inning and occurrence props |
| NHL v7 | Game play-by-play; boxscore/summary reconciliation | Goal/shot/assist/penalty/save, score, period/clock, skater/goalie totals | Moneyline/puck line/totals, 60-minute line, player shots/goals/assists/points, goalie saves, period props |
| Soccer Extended v4 | Sport Event Timeline or aggregate Live Timelines; summary reconciliation | Goal/assist/shot/SOT/card/corner/substitution, score, period/time, player/team totals | Three-way result, handicap/totals, correct score, HT/FT, scorer/assist, SOT, cards/corners, clean sheet, double chance; Asian split lines via evaluator semantics |
| Tennis v3 | Sport Event Timeline or aggregate Live Timelines | Point/game/set, server, tiebreak, ace/double fault, score, match status | Match/set winner, game handicap, total games/sets, exact set score, aces/double faults, tiebreak/win-a-set occurrence; coverage-tier gated |
| MMA v2 / UFC | Aggregate Live Summaries plus Sport Event Summary | Round/fight clock, result/method, knockdowns/takedowns/significant strikes when covered | Fighter result, round total/time, method, goes-distance, covered fighter-stat props; final-only where only official summary exists |
| NASCAR Cup | Race Leaderboard, then official race results/change log | Lap, running order, status, gap, laps led, fastest lap, cautions/lead changes when exposed | Winner/top-N/head-to-head, finishing position, laps-led/fastest-lap and race props only when the leaderboard contains the needed fact |
| Formula 1 v2 | Stage Summary for race/qualifying/practice | Lap, position, status, gap/interval, laps led, fastest lap/time | Winner/podium/top-N/head-to-head, qualifying/race position, fastest lap, laps-led; wait for confirmed results for final settlement |
| PGA Golf v3 | Tournament Leaderboard with per-round data | Position/tie, strokes relative to par, hole, round, player round/tournament totals | Outright/top-N, round leader, head-to-head/group, make cut, round/tournament props where present; dead-heat aware |
| Global Basketball v2 | Sport Event Timeline or aggregate Live Timelines | Coverage-gated score/period, timeline events, player/team stats | Same canonical basketball families, but only facts promised by each event’s coverage properties |
| Global American Football v2 | Sport Event Timeline or aggregate Live Timelines | Coverage-gated scoring, quarter/clock, timeline and available stats | Team outcomes/totals broadly; player props only when explicit player-stat coverage exists |
| Global Ice Hockey v2 | Sport Event Timeline or aggregate Live Timelines | Coverage-gated score/period, goals/penalties and player/team stats | Team outcomes/totals and 3-way regulation; player props only with matching coverage flags |
| Global Baseball v2 | Sport Event Timeline or aggregate Live Timelines | Coverage-gated inning/score, play timeline, player/team stats | Team outcomes/totals and inning checkpoints; player props only where the required stats are live-covered |

NFL and NCAA football play-by-play provide live timelines plus player and team statistics earned on each play.[^27][^28] The league-specific basketball, MLB, and NHL products likewise provide real-time play-by-play feeds, while soccer and tennis expose event timelines and aggregate live-timeline endpoints.[^23][^29][^30][^31][^32][^41] MMA provides live and event summaries with round, result, and covered competitor statistics.[^40] F1 Stage Summary updates lap by lap, NASCAR Race Leaderboard updates as drivers cross the line, and the PGA leaderboard supplies real-time position and per-round statistics.[^33][^34][^35]

The four Global Sport products must read each event’s coverage properties before enabling a market. Their timelines can provide real-time scoring and play-by-play, but depth varies by event.[^36][^37][^38][^39] A leg that needs deeper player statistics is not live-trackable merely because the event has live scores.

### Product selection and overlap rules

- Prefer the league-specific API for NFL, NCAA, NBA/WNBA/NCAA basketball, MLB, and NHL because its play model and statistics are richer.
- Use Global Sport APIs for competitions outside those league-specific products and as an explicitly labeled fallback only.
- Store cross-product mapping IDs where Sportradar provides mappings, and enforce one authoritative provider source per event/version. Never poll both products and create duplicate facts for the same game.
- Keep product quotas separate even when one master key authenticates them. A request lease names the exact product and endpoint family.
- Aggregate live endpoints are especially valuable under trial: one call can update all tracked live events returned by that product. Event-specific feeds are preferred when only one event is tracked or richer statistics are required.
- The manifest declares `minimumCoverage` for each canonical stat. Extraction support is intersected with event coverage at confirmation and again at event start.

### Special ticket structures

- **Parlay/SGP:** all active legs contribute to ticket state; show a compact `3 won · 2 live · 1 pending` summary and avoid sending duplicate leg and ticket pushes at the same instant. DraftKings’ basic parlay guide defines the ordinary all-legs-must-win behavior.[^7]
- **Progressive parlay:** the extraction must identify allowed misses and payout tiers; it cannot use ordinary parlay evaluation.[^7]
- **Round robin:** represent the generated combinations and their independent settlement, not only the source selections.
- **Teaser:** preserve adjusted spreads/totals and teaser-specific push rules.
- **Same-game/live parlay:** preserve grouping and accepted-at line. A void/push can cause repricing under sportsbook-specific rules rather than simple deletion of a leg.[^22]
- **Futures/multi-event markets:** use checkpoint or final-only tracking unless reliable standings/leaderboard semantics are available.

## Notification event catalog

Use a typed event catalog rather than unrestricted strings:

| Type | Purpose |
| --- | --- |
| `ticket.ready_for_review` | Extraction completed and needs confirmation |
| `ticket.tracking_started` | All required entities and events resolved |
| `event.started` | Relevant event entered live state |
| `leg.progress` | Current value changed and policy allows an update |
| `leg.milestone` | Near target, target reached, lead changed, or other meaningful state |
| `period.ended` | Relevant quarter/half/period/inning/set/round ended |
| `leg.won`, `leg.lost`, `leg.push`, `leg.void` | Definitive leg settlement |
| `ticket.progress` | Coalesced multi-leg status summary |
| `ticket.won`, `ticket.lost`, `ticket.push`, `ticket.partially_void` | Definitive ticket settlement |
| `event.delayed`, `event.postponed`, `event.cancelled` | Schedule state affecting tracking |
| `tracking.degraded`, `tracking.resumed` | Provider coverage or freshness materially changed |
| `extraction.failed`, `resolution.required` | User action required |

Each notification candidate should include structured data: ticket/leg/event IDs, source observation sequence, previous/current values, component breakdown, target, period, clock, finality, and deep-link destination. Copy is rendered from typed templates so push, email, and in-app representations remain consistent.

The idempotency key should be derived from `leg + provider sequence/revision + notification type + policy version`. Corrections need a distinct event rather than being suppressed by the original sequence. Coalescing should create a delivery window while retaining the underlying candidates for audit.

## Current implementation assessment

The repository already has strong foundations:

- Private upload storage, queued extraction, review/confirmation, and event/participant resolution.
- Shared sports-event subscriptions so one provider fetch serves multiple users.
- Idempotent notification records, per-channel delivery rows, retry handling, in-app records, Expo push, browser web push, and Resend email.
- Basic additive player markets and team moneyline/spread evaluation.

The principal gaps are:

1. **Extraction semantics are incomplete.** There is no normalized odds/stake/payout, pregame/live context, period scope, overtime policy, settlement profile, evidence coordinates, or provider support level.
2. **The market model is too flat.** `marketComponents` can sum stats but cannot represent timing, rank bands, occurrences, ranges, opponent comparisons, split handicaps, exact set scores, or multi-event formulas.
3. **Live ingestion uses the wrong source shape and cadence.** Active events are currently fetched from summary/boxscore endpoints every 30 seconds. It calls more often than the 5–15 minute product promise requires while still lacking cumulative play-level detail needed to explain interval changes.
4. **Evaluation exposes only status change.** It does not produce component changes, period/clock, live lead state, provisional completion, or correction events.
5. **Notification policy is outcome-only.** Preferences cover leg/ticket won/lost and channel enablement, while progress, period, push/void, coalescing, quiet hours, and per-ticket frequency are absent.
6. **Copy lacks context.** Existing messages say only that a leg or ticket is won/lost; they omit subject, market, score/stat, target, period, and clock.
7. **Settlement fidelity needs sportsbook rules.** Generic evaluator behavior cannot capture DraftKings-specific participation, overtime, interruption, dead-heat, and SGP repricing rules.

## Phased implementation plan

### Repository-level change map

| Area | Primary change |
| --- | --- |
| `packages/contracts` | Add canonical ticket, leg, odds, scope, expression, support-level, progress-delta, and typed-notification schemas |
| `packages/db` | Add sportsbook/rule/evidence fields, expression storage, append-only observations, metric snapshots, notification candidates, coalescing state, and expanded preferences |
| `apps/server/src/services/gemini.ts` | Change the model contract from final market rows to source-faithful candidates with field confidence and evidence |
| New extraction compiler service | Apply DraftKings template parsing, catalog lookup, semantic validation, and provider-capability checks |
| `apps/server/src/services/sports.ts` | Split provider adapters, ingestion, normalization, expression evaluation, and reconciliation; replace the summary-only orchestration |
| `packages/domain/src/tracking` | Evaluate expression trees and return revision-safe progress deltas with provisional vs definitive settlement |
| `apps/server/src/services/notifications.ts` | Introduce candidate policy, coalescing, typed templates, per-channel behavior, and correction handling before delivery fan-out |
| Web/mobile ticket review | Display source crops, uncertainty, trackability, scope, and notification-frequency controls |

The migration should be additive: continue reading existing flat legs through a compatibility translator while new extractions use the canonical model. Backfill only fields that can be inferred safely; otherwise retain the leg as legacy/final-only rather than manufacturing semantics.

### Phase 0 — Market catalog and product contract

- Define the canonical types, metric-expression AST, time scopes, settlement states, and typed notification events.
- Build a DraftKings phrase-to-market catalog from real anonymized tickets and the guide/rule taxonomy.
- Create the market/provider capability matrix with `live`, `checkpoint`, `final_only`, and `unsupported` levels.
- Decide the exact language for **target reached**, **official result**, and **sportsbook settled** so the UI never overclaims.

**Exit criterion:** every supported market has a deterministic semantic fixture and provider-data contract.

### Phase 1 — Trustworthy extraction

- Extend ticket/leg schemas with sportsbook, accepted-at context, odds, stake/payout, scope, rule profile, evidence, field confidence, and support level.
- Add a DraftKings layout adapter before the general model.
- Compile model output through the versioned catalog; reject semantically incomplete legs.
- Redesign review around highlighted uncertainty and original image crops.
- Collect corrections as an evaluation dataset.

**Exit criterion:** at least 99% exact semantic accuracy on the supported DraftKings golden set; no unsupported leg silently marked trackable.

### Phase 2 — Canonical observations and replayable evaluation

- Add append-only provider observation storage with sequence, revision, operation, period, clock, and raw payload reference.
- Add dependency indexing from facts to metric expressions.
- Make evaluation revision-safe and return `ProgressDelta`.
- Recalculate on update/delete corrections and reconcile at boundaries/final.

**Exit criterion:** deterministic replay produces the same leg/ticket states for duplicates, gaps, out-of-order events, and corrections.

### Phase 3 — Quota-aware Cloudflare ingestion core

- Add the product-manifest registry for all 18 configured Sportradar products.
- Add entitlement configuration with `trial_rest`, `production_rest`, and `production_push` modes; remove hardcoded trial paths.
- Add one Product Budget Durable Object per product; retain D1 `next_poll_at`, the minute Cron, and the sports Queue for event scheduling.
- Change schedule discovery from all-product sweeps to cached, on-demand resolution for confirmed tickets.
- Add R2 raw payload archives, observation queue, canonical facts, response-header/coverage parsing, and Analytics Engine usage telemetry.
- Implement adaptive cadence, reserved finalization calls, aggregate-live selection, 429 delay/backoff, and transparent degradation.

**Exit criterion:** no provider call can bypass the product quota allocator; simulations prove the scheduler remains inside a configured rolling quota and always preserves its reserved final calls.

### Phase 4 — NFL and NCAA football production slice

- Implement NFL v7 and NCAA Football v7 play-by-play, statistics/boxscore reconciliation, coverage parsing, and post-final correction checks.
- Support the complete football market set listed in the product manifest, including mixed team/player parlays.
- Implement play-aware component changes, touchdown reversals, quarter/halftime/final boundaries, overtime scope, and football interval-summary templates.
- Validate both products at 5-, 10-, and 15-minute trial and production REST cadences using recorded replays.

**Exit criterion:** deterministic game replays pass all football extraction, tracking, correction, coalescing, and settlement fixtures; a live trial event stays within its allocated call budget and reports its actual freshness.

### Phase 5 — Notification intelligence

- Add per-ticket 5-, 10-, and 15-minute cadence controls plus notification disablement.
- Add candidate persistence, per-user window watermarks, typed digest templates, per-channel defaults, quiet hours, per-ticket override, and mute.
- Keep the complete timeline in-app while applying stricter push/email policy.
- Add push, void, partial-void, postponement, provider degradation, and correction messages.

**Exit criterion:** notification golden tests prove exact trigger count/order/copy for representative game replays.

### Phase 6 — Complete every active product adapter

Implement all remaining manifests already specified in this document in parallel workstreams:

- **Basketball:** NBA, WNBA, NCAA men, NCAA women, and Global Basketball.
- **Field/team sports:** MLB, NHL, Soccer Extended, Global Baseball, Global Ice Hockey, and Global American Football.
- **Individual sports:** Tennis, MMA/UFC, PGA, NASCAR, and Formula 1.

Each adapter includes discovery, event identity, coverage parser, live/aggregate endpoint choice, canonical facts, reconciliation, correction strategy, quota presets, replay fixture, and market-capability tests. Basketball’s Durant 3PM and LeBron PRA experiences are completed before its season begins, but do not block football’s first release.

**Exit criterion:** all 18 configured products can resolve and ingest a real trial event, pass a stored replay, report per-event coverage, and classify every catalog market as live/checkpoint/final-only/unsupported.

### Phase 7 — Advanced wager structures across the same adapters

Implement period and race-to markets, Asian handicaps, dead-heat payout estimates, progressive parlays, round robins, teasers, futures, and sportsbook-specific live-SGP repricing. Their semantics are defined in the catalog from the start; this phase adds product UI and settlement coverage after the foundational evaluators pass.

These phases are an implementation dependency order, not deferred research. The contracts, manifests, market mappings, trial behavior, and acceptance requirements for every currently supported API are defined before Phase 0 closes.

## Acceptance scenarios

### Extraction

1. `Kevin Durant 3+ Threes` compiles to `three_pointers_made >= 3`, not `> 3`.
2. `Kevin Durant Over 3.5 Threes` compiles to `three_pointers_made > 3.5` and displays progress toward four.
3. `LeBron James 29.5 Pts + Rebs + Asts — Over` remains one leg with a three-term sum.
4. `Phoenix Suns +3.5` compiles to spread, while `Phoenix Suns +135` compiles to American moneyline odds; the plus sign alone is not enough.
5. `60 Minute Line` in hockey excludes overtime/shootout; ordinary two-way moneyline uses its rule profile.
6. Soccer three-way moneyline preserves draw as a valid selection and regulation scope.
7. A live ticket preserves its accepted line and placed-at context.
8. An unreadable decimal point or period label forces review.

### Live progress and correction

1. A football completion updates quarterback passing yards, receiver receptions/yards, and every affected team/total expression from one play.
2. A touchdown produces one scorer occurrence and the correct score change; a review reversal retracts both.
3. A Durant made-three event changes 0→1 and yields exactly one `leg.progress` candidate.
4. A duplicate provider message yields no duplicate candidate or delivery.
5. A provider correction 3→2 creates a correction update and removes provisional “target reached” state.
6. PRA reports both sum and changed components.
7. An ingestion reconnect recovers missing plays through REST and emits only alerts not already delivered.
8. Final summary reconciliation matches official player/team values before definitive settlement.

### Trial and entitlement behavior

1. Every outbound Sportradar call first receives a product-specific quota/QPS lease.
2. Concurrent event alarms for the same product never exceed its configured QPS.
3. Remaining quota below the reserved floor disables optional progress polls but retains boundary/final calls.
4. A 429 honors server guidance where available, applies delayed exponential backoff, and does not create a false tracking failure.
5. Changing `accessLevel` and `transport` requires no change to canonical facts, evaluators, or notification templates.
6. An event without the required player-stat coverage is visibly checkpoint/final-only or unsupported before tracking begins.
7. An aggregate live response is fetched once and fans out to every tracked event it contains.
8. Quota exhaustion changes the visible freshness/degradation state and never reuses stale data as if it were current.

### Notification policy

1. A 5-minute 3PM summary reports the current count and all makes since the prior watermark without sending one alert per make.
2. A PRA summary reports the aggregate and per-component interval changes.
3. Basketball moneyline reports the latest score and important lead/boundary events crossed within the user’s interval, not every basket.
4. Under props do not produce “won” before the final applicable boundary.
5. One observation that wins the last leg and ticket produces a coherent grouped push, not two redundant pushes.
6. Quiet hours suppress push but retain in-app history and release only still-relevant summaries.

## Quality and operating metrics

- Field-level OCR accuracy and exact semantic compilation accuracy.
- Sportsbook/event/player resolution accuracy and manual-review rate.
- Unsupported-market false-positive rate; target zero.
- Provider freshness at each interval fetch and due-summary delivery punctuality at p50/p95/p99 relative to the user’s selected cadence.
- Missing, duplicate, out-of-order, and corrected observation rates.
- Duplicate user-visible notification rate; target effectively zero.
- Final settlement agreement with reviewed sportsbook tickets.
- Alerts per live ticket by policy, push disable/mute rate, and notification-open rate.
- Queue age, delivery success, provider freshness, reconnect frequency, and reconciliation mismatch rate.

## Product guardrails

- Notifications should be factual tracking updates, never prompts to chase losses, place another live bet, or increase stake.
- Do not claim ParlayPal is the source of official settlement. Use “target reached” for live calculations and “final result” only after reconciliation; the sportsbook remains authoritative for payout.
- Never expose account numbers or unrelated ticket details in lock-screen notification copy.
- Allow immediate ticket mute and global pause.
- Retain enough source evidence, rule version, raw observation, evaluation output, and notification decision data to explain every alert.

## Source notes

The DraftKings “How to Bet” pages are useful for discovering customer-facing wager vocabulary and common ticket shapes; they are not a sufficient settlement specification. DraftKings’ General Rules, sport rules, and market rules establish precedence and contain exceptions for overtime, pushes, dead heats, participation, interruptions, and voiding.[^20][^21][^22] The implementation must version and test those rule profiles separately from guide copy.

All supplied materials contribute to the design as follows:

- Betting basics define the customer-visible distinctions among moneyline, spread, over/under, parlay, and in-play wagers.[^2][^3][^7][^8][^10][^14]
- The odds pages establish the three displayed odds formats, implied probability, stake/profit/payout fields, combined-parlay calculation, and rounding caveat.[^9][^11][^12]
- The sport guides supply the market-discovery taxonomy used in the support map for tennis, golf, soccer, basketball, hockey, baseball, MMA, football, and NASCAR.[^1][^4][^5][^6][^15][^16][^17][^18][^19]
- The offshore page contributes sportsbook-source and consumer-protection context rather than a new trackable market.[^13]

The offshore-betting page is compliance and consumer-protection content rather than a market definition.[^13] It does not add extraction semantics, but it reinforces that ParlayPal should identify the sportsbook source and avoid implying equivalence between regulated sportsbook settlement and unverified operators.

## Sources

[^1]: DraftKings Sportsbook, [Tennis Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/tennis-betting-guide), updated June 16, 2026.

[^2]: DraftKings Sportsbook, [How to Bet](https://sportsbook.draftkings.com/help/how-to-bet), updated June 16, 2026.

[^3]: DraftKings Sportsbook, [How to Bet the Spread](https://sportsbook.draftkings.com/help/how-to-bet-spread), updated June 16, 2026.

[^4]: DraftKings Sportsbook, [Golf Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/golf-betting-guide), updated June 16, 2026.

[^5]: DraftKings Sportsbook, [Soccer Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/soccer-betting-guide), updated June 16, 2026.

[^6]: DraftKings Sportsbook, [Basketball Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/basketball-betting-guide), updated June 16, 2026.

[^7]: DraftKings Sportsbook, [How to Bet a Parlay](https://sportsbook.draftkings.com/help/how-to-bet-parlay), updated June 16, 2026.

[^8]: DraftKings Sportsbook, [How to Bet Moneyline](https://sportsbook.draftkings.com/help/how-to-bet-moneyline), updated June 16, 2026.

[^9]: DraftKings Sportsbook, [How to Read Odds](https://sportsbook.draftkings.com/help/how-to-bet-reading-odds), updated June 16, 2026.

[^10]: DraftKings Sportsbook, [How to Bet Live](https://sportsbook.draftkings.com/help/how-to-bet-live-bets), updated June 16, 2026.

[^11]: DraftKings Sportsbook, [Odds Calculator](https://sportsbook.draftkings.com/help/how-to-bet/odds-calculator), updated June 16, 2026.

[^12]: DraftKings Sportsbook, [Parlay Calculator](https://sportsbook.draftkings.com/help/how-to-bet/parlay-calculator), updated June 16, 2026.

[^13]: DraftKings Sportsbook, [Offshore Betting](https://sportsbook.draftkings.com/help/how-to-bet/offshore-betting), updated June 16, 2026.

[^14]: DraftKings Sportsbook, [How to Bet Over/Under](https://sportsbook.draftkings.com/help/how-to-bet-over-under), updated June 16, 2026.

[^15]: DraftKings Sportsbook, [Hockey Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/hockey-betting-guide), updated June 16, 2026.

[^16]: DraftKings Sportsbook, [Baseball Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/baseball-betting-guide), updated June 16, 2026.

[^17]: DraftKings Sportsbook, [MMA Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/mma-betting-guide), updated June 16, 2026.

[^18]: DraftKings Sportsbook, [Football Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/football-betting-guide), updated June 16, 2026.

[^19]: DraftKings Sportsbook, [NASCAR Betting Guide](https://sportsbook.draftkings.com/help/how-to-bet/nascar-betting-guide), updated June 16, 2026.

[^20]: DraftKings Sportsbook, [General Rules](https://sportsbook.draftkings.com/help/general-betting-rules/general-rules).

[^21]: DraftKings Sportsbook, [Basketball Rules](https://sportsbook.draftkings.com/help/sport-rules/basketball), as of December 22, 2025.

[^22]: DraftKings Sportsbook, [MMA Rules](https://sportsbook.draftkings.com/help/sport-rules/mma).

[^23]: Sportradar Developer Portal, [NBA Game Play-by-Play](https://developer.sportradar.com/basketball/reference/nba-play-by-play).

[^24]: Sportradar Developer Portal, [NBA Push Events](https://developer.sportradar.com/basketball/reference/nba-push-events).

[^25]: Sportradar Developer Portal, [NBA Push Feeds](https://developer.sportradar.com/basketball/docs/nba-ig-push).

[^26]: Sportradar Developer Portal, [Your Account: trial, production, quotas, and QPS](https://developer.sportradar.com/getting-started/docs/your-account).

[^27]: Sportradar Developer Portal, [NFL Update Frequencies](https://developer.sportradar.com/football/docs/nfl-ig-update-frequencies).

[^28]: Sportradar Developer Portal, [NCAA Football Game Play-by-Play](https://developer.sportradar.com/football/reference/ncaafb-play-by-play).

[^29]: Sportradar Developer Portal, [MLB Game Play-by-Play](https://developer.sportradar.com/baseball/reference/mlb-play-by-play).

[^30]: Sportradar Developer Portal, [NHL Game Play-by-Play](https://developer.sportradar.com/ice-hockey/reference/nhl-game-play-by-play).

[^31]: Sportradar Developer Portal, [Soccer Sport Event Timeline](https://developer.sportradar.com/soccer/reference/soccer-sport-event-timeline).

[^32]: Sportradar Developer Portal, [Tennis Sport Event Timeline](https://developer.sportradar.com/tennis/reference/sport-event-timeline).

[^33]: Sportradar Developer Portal, [Formula 1 Stage Summary](https://developer.sportradar.com/racing/reference/f1-stage-summary).

[^34]: Sportradar Developer Portal, [NASCAR Update Frequencies](https://developer.sportradar.com/racing/docs/nascar-ig-update-frequencies).

[^35]: Sportradar Developer Portal, [Golf Tournament Leaderboard](https://developer.sportradar.com/golf/reference/golf-tournament-leaderboard).

[^36]: Sportradar Developer Portal, [Global Basketball Sport Event Timeline](https://developer.sportradar.com/basketball/reference/global-basketball-sport-event-timeline).

[^37]: Sportradar Developer Portal, [Global American Football Sport Event Timeline](https://developer.sportradar.com/football/reference/global-american-football-sport-event-timeline).

[^38]: Sportradar Developer Portal, [Global Ice Hockey Sport Event Timeline](https://developer.sportradar.com/ice-hockey/reference/global-ice-hockey-sport-event-timeline).

[^39]: Sportradar Developer Portal, [Global Baseball Sport Event Timeline](https://developer.sportradar.com/baseball/reference/global-baseball-sport-event-timeline).

[^40]: Sportradar Developer Portal, [MMA Live Summaries](https://developer.sportradar.com/mma/reference/mma-live-summaries).

[^41]: Sportradar Developer Portal, [NCAA Men’s Basketball Game Play-by-Play](https://developer.sportradar.com/basketball/reference/ncaamb-play-by-play).

[^42]: Cloudflare, [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/).

[^43]: Cloudflare, [Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/).

[^44]: Cloudflare, [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/).

[^45]: Cloudflare, [Queue batching, retries, and delays](https://developers.cloudflare.com/queues/configuration/batching-retries/).
