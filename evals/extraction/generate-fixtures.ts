#!/usr/bin/env bun
/**
 * Generates synthetic bet-slip fixture images + ground-truth labels for the
 * extraction eval.
 *
 * Renders each slip as HTML, screenshots it with headless Chrome, and writes
 * fixtures/labels.jsonl entries whose values match the rendered content
 * exactly (the only manual labeling step that is ever needed for these).
 *
 * Usage: bun evals/extraction/generate-fixtures.ts
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { join } = path;

const FIXTURES_DIR = join(new URL(".", import.meta.url).pathname, "fixtures");
// Prefer the harness-approved temp dir (os.tmpdir()/opencode) over raw /tmp.
const TMP_DIR = join(tmpdir(), "opencode", "ppal-eval-html");

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

const findChrome = (): string => {
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  console.error(
    "No Chrome/Chromium/Edge found in /Applications for rendering."
  );
  process.exit(1);
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const today = new Date();
today.setHours(12, 0, 0, 0);

const dateAt = (dayOffset: number): Date => {
  const date = new Date(today);
  date.setDate(date.getDate() + dayOffset);
  return date;
};

const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const shortDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "numeric",
    weekday: "short",
  });

const longDate = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 750px;
    background: #0b0e14;
    color: #e9eef6;
    font-family: -apple-system, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .app { padding: 26px 22px 40px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .logo { font-weight: 800; font-size: 23px; letter-spacing: -0.4px; }
  .logo .accent { opacity: 0.95; }
  .pill { background: #222a37; color: #aeb9c9; border-radius: 999px; padding: 7px 15px; font-size: 13px; font-weight: 600; }
  .card { background: #151b25; border: 1px solid #1f2733; border-radius: 18px; padding: 20px; margin-bottom: 16px; }
  .bet-kind { font-size: 11.5px; text-transform: uppercase; letter-spacing: 1.4px; color: #7f8ca0; font-weight: 700; margin-bottom: 4px; }
  .leg { padding: 15px 0; border-bottom: 1px solid #222a36; }
  .leg:last-child { border-bottom: none; padding-bottom: 4px; }
  .leg-line { font-size: 17px; font-weight: 700; line-height: 1.35; display: flex; justify-content: space-between; gap: 12px; }
  .leg-line .odds { color: #f2f6fb; font-weight: 700; white-space: nowrap; }
  .leg-sub { font-size: 13.5px; color: #909db2; margin-top: 5px; line-height: 1.45; }
  .leg-sub .score { color: #c8d2e0; font-weight: 600; }
  .tick { color: #34d399; font-weight: 800; }
  .cross { color: #f87171; font-weight: 800; }
  .stake-rows { margin-top: 14px; border-top: 1px solid #222a36; padding-top: 13px; }
  .stake-row { display: flex; justify-content: space-between; font-size: 14px; color: #aeb9c9; padding: 3px 0; }
  .stake-row b { color: #f2f6fb; font-weight: 700; }
  .banner { border-radius: 14px; padding: 18px; text-align: center; margin: 4px 0 16px; }
  .banner-won { background: linear-gradient(135deg, #0d3b26, #116539); color: #4ade80; }
  .banner-lost { background: linear-gradient(135deg, #3b0d12, #7f1d1d); color: #fca5a5; }
  .banner .title { font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
  .banner .sub { font-size: 14px; margin-top: 5px; opacity: 0.9; }
  .footer { text-align: center; color: #5d6a7d; font-size: 12px; margin-top: 18px; line-height: 1.6; }
  .navbar { display: flex; justify-content: space-around; border-top: 1px solid #1f2733; padding: 16px 0 26px; color: #6d7a8e; font-size: 12.5px; font-weight: 600; margin: 6px -22px -40px; background: #0e131b; }
  .navbar .active { color: #4ade80; }
`;

const page = (
  title: string,
  accent: string,
  bodyHtml: string,
  height: number,
  options?: { navbar?: boolean }
): string => `
<!doctype html>
<html><head><meta charset="utf-8"><style>${BASE_CSS}
body { min-height: ${height}px; }
</style></head>
<body><div class="app">
  <div class="header">
    <div class="logo" style="color:${accent}">${title}</div>
    <div class="pill">Balance $412.87</div>
  </div>
  ${bodyHtml}
  ${options?.navbar === false ? "" : `<div class="navbar"><span>Home</span><span class="active">My Bets</span><span>Betslip</span><span>Live</span><span>Profile</span></div>`}
</div></body></html>`;

const leg = (line: string, odds: string, sub: string): string => `
  <div class="leg">
    <div class="leg-line"><span>${line}</span><span class="odds">${odds}</span></div>
    <div class="leg-sub">${sub}</div>
  </div>`;

const stakeRows = (placed: string, stake: string, toWin: string): string => `
  <div class="stake-rows">
    <div class="stake-row"><span>Placed</span><b>${placed}</b></div>
    <div class="stake-row"><span>Wager</span><b>${stake}</b></div>
    <div class="stake-row"><span>To Win</span><b>${toWin}</b></div>
  </div>`;

interface RenderTarget {
  file: string;
  height: number;
  html: string;
}

const targets: RenderTarget[] = [];

// --- 1. FanDuel active 3-leg parlay (upcoming games) ------------------------
{
  const d0 = dateAt(0);
  const d1 = dateAt(1);
  const html = page(
    "FanDuel",
    "#22b0ff",
    `
    <div class="card">
      <div class="bet-kind">Parlay &middot; 3 Legs</div>
      ${leg("Chiefs Moneyline", "-150", `Chiefs vs Raiders &bull; ${shortDate(d0)} 1:00 PM ET &bull; NFL`)}
      ${leg("Patrick Mahomes Over 265.5 Passing Yards", "+115", `Chiefs vs Raiders &bull; ${shortDate(d0)} 1:00 PM ET &bull; NFL`)}
      ${leg("Bills -2.5", "-110", `Bills vs Jets &bull; ${shortDate(d1)} 8:15 PM ET &bull; NFL`)}
      ${stakeRows(`${longDate(today)}, 9:41 AM`, "$25.00", "$67.50")}
      <div class="footer">Bet ID 4471-8823-A<br>FanDuel Sportsbook &amp; Casino &bull; 21+</div>
    </div>`,
    980
  );
  targets.push({ file: "fanduel-active-parlay.png", height: 980, html });
}

// --- 2. DraftKings SGP today ------------------------------------------------
{
  const html = page(
    "DraftKings",
    "#53d33d",
    `
    <div class="card">
      <div class="bet-kind">Same Game Parlay &middot; 3 Legs</div>
      ${leg("Luka Doncic Over 34.5 Pts+Reb+Ast", "-120", "Lakers vs Celtics &bull; Today 7:30 PM ET &bull; NBA")}
      ${leg("LeBron James Over 5.5 Assists", "-115", "Lakers vs Celtics &bull; Today 7:30 PM ET &bull; NBA")}
      ${leg("Celtics Moneyline", "+105", "Lakers vs Celtics &bull; Today 7:30 PM ET &bull; NBA")}
      ${stakeRows(`${longDate(today)}, 6:02 PM`, "$10.00", "$47.23")}
      <div class="footer">SGP &bull; Bet ID DK-88120<br>DraftKings Sportsbook</div>
    </div>`,
    980
  );
  targets.push({ file: "draftkings-sgp-today.png", height: 980, html });
}

// --- 3. FanDuel settled WON parlay ------------------------------------------
{
  const d3 = dateAt(-3);
  const d2 = dateAt(-2);
  const html = page(
    "FanDuel",
    "#22b0ff",
    `
    <div class="banner banner-won"><div class="title">WON</div><div class="sub">You won $85.50 &mdash; paid to your account</div></div>
    <div class="card">
      <div class="bet-kind">Parlay &middot; 3 Legs</div>
      ${leg("Eagles -3.5", "-110", `<span class="score">Eagles vs Giants &bull; Final 27-17</span> &bull; ${longDate(d3)} &bull; NFL <span class="tick">&#10003;</span>`)}
      ${leg("Chiefs Moneyline", "-140", `<span class="score">Chiefs vs Broncos &bull; Final 31-17</span> &bull; ${longDate(d2)} &bull; NFL <span class="tick">&#10003;</span>`)}
      ${leg("Jalen Hurts Over 1.5 Passing TDs", "+125", `<span class="score">Eagles vs Giants &bull; Final 27-17</span> &bull; ${longDate(d3)} &bull; NFL <span class="tick">&#10003;</span>`)}
      ${stakeRows(`${longDate(d3)}, 11:20 AM`, "$25.00", "$85.50")}
      <div class="footer">Bet ID 4471-8890-C<br>FanDuel Sportsbook &amp; Casino</div>
    </div>`,
    1080
  );
  targets.push({ file: "fanduel-settled-won.png", height: 1080, html });
}

// --- 4. DraftKings settled LOST single ---------------------------------------
{
  const d1 = dateAt(-1);
  const html = page(
    "DraftKings",
    "#53d33d",
    `
    <div class="banner banner-lost"><div class="title">LOST</div><div class="sub">Bet didn't win</div></div>
    <div class="card">
      <div class="bet-kind">Straight Bet</div>
      ${leg("Luka Doncic Over 30.5 Points", "-115", `<span class="score">Lakers vs Suns &bull; Final 102-110</span> &bull; ${longDate(d1)} &bull; NBA <span class="cross">&#10007;</span>`)}
      ${stakeRows(`${longDate(d1)}, 5:47 PM`, "$50.00", "$93.48")}
      <div class="footer">Bet ID DK-88417<br>DraftKings Sportsbook</div>
    </div>`,
    840
  );
  targets.push({ file: "draftkings-settled-lost.png", height: 840, html });
}

// --- 5. PrizePicks entry ------------------------------------------------------
{
  const d0 = dateAt(0);
  const d1 = dateAt(1);
  const html = page(
    "PrizePicks",
    "#4ade80",
    `
    <div class="card">
      <div class="bet-kind">Flex Play &middot; 3 Picks</div>
      ${leg("Shai Gilgeous-Alexander <span style='color:#4ade80'>More</span> 31.5 Points", "1P", `OKC Thunder &bull; ${shortDate(d0)}`)}
      ${leg("Nikola Jokic <span style='color:#4ade80'>More</span> 12.5 Rebounds", "1P", `Denver Nuggets &bull; ${shortDate(d1)}`)}
      ${leg("Tyrese Maxey <span style='color:#f97316'>Less</span> 27.5 Pts+Reb+Ast", "1P", `Philadelphia 76ers &bull; ${shortDate(d1)}`)}
      ${stakeRows(`${longDate(today)}, 12:15 PM`, "$30.00", "$150.00")}
      <div class="footer">Standard payout 5x &bull; Entry #PP-77120</div>
    </div>`,
    980
  );
  targets.push({ file: "prizepicks-entry.png", height: 980, html });
}

// --- 6. ESPN BET day-of Sunday slate ------------------------------------------
{
  const html = page(
    "ESPN BET",
    "#ff5a5f",
    `
    <div class="card">
      <div class="bet-kind">Parlay &middot; 3 Legs &middot; Sunday Slate</div>
      ${leg("Packers -1.5", "-105", "Packers vs Cardinals &bull; Today 4:25 PM ET &bull; NFL")}
      ${leg("Bears vs Texans Over 44.5", "-110", "Bears vs Texans &bull; Today 1:00 PM ET &bull; NFL")}
      ${leg("Lions Moneyline", "-120", "Lions vs Cowboys &bull; Today 8:20 PM ET &bull; NFL")}
      ${stakeRows(`${longDate(today)}, 12:58 PM`, "$15.00", "$58.40")}
      <div class="footer">Bet ID EB-20931<br>ESPN BET &bull; All legs start today</div>
    </div>`,
    980
  );
  targets.push({ file: "espnbet-dayof-slate.png", height: 980, html });
}

// --- 7. Mixed past/future parlay (the "found the app late" case) ---------------
{
  const d3 = dateAt(-3);
  const d2 = dateAt(2);
  const d4 = dateAt(4);
  const html = page(
    "FanDuel",
    "#22b0ff",
    `
    <div class="card">
      <div class="bet-kind">Parlay &middot; 3 Legs &middot; In Progress</div>
      ${leg("Nuggets Moneyline", "-135", `<span class="score">Nuggets vs Spurs &bull; Final 118-108</span> &bull; ${longDate(d3)} &bull; NBA <span class="tick">&#10003;</span>`)}
      ${leg("Victor Wembanyama Over 24.5 Points", "-110", `Spurs vs Mavericks &bull; ${shortDate(d2)} 8:00 PM ET &bull; NBA`)}
      ${leg("Suns -4.5", "-105", `Suns vs Warriors &bull; ${shortDate(d4)} 10:00 PM ET &bull; NBA`)}
      ${stakeRows(`${longDate(d3)}, 8:02 PM`, "$20.00", "$71.20")}
      <div class="footer">1 of 3 legs settled &bull; Bet ID 4471-9033-F<br>FanDuel Sportsbook</div>
    </div>`,
    1020
  );
  targets.push({ file: "fanduel-mixed-parlay.png", height: 1020, html });
}

// --- 8. Underdog pass+rush props -----------------------------------------------
{
  const d0 = dateAt(0);
  const d1 = dateAt(1);
  const html = page(
    "Underdog",
    "#ff6a3d",
    `
    <div class="card">
      <div class="bet-kind">2 Pick Entry &middot; Standard</div>
      ${leg("Josh Allen <span style='color:#4ade80'>More</span> 249.5 Pass+Rush Yards", "1P", `Buffalo Bills &bull; ${shortDate(d0)} 1:00 PM ET`)}
      ${leg("C.J. Stroud <span style='color:#4ade80'>More</span> 245.5 Passing Yards", "1P", `Houston Texans &bull; ${shortDate(d1)} 1:00 PM ET`)}
      ${stakeRows(`${longDate(today)}, 10:11 AM`, "$20.00", "$38.00")}
      <div class="footer">Entry UD-33912 &bull; 1.9x payout</div>
    </div>`,
    900
  );
  targets.push({ file: "underdog-props.png", height: 900, html });
}

// --- 9. Caesars teaser ----------------------------------------------------------
{
  const d0 = dateAt(0);
  const d1 = dateAt(1);
  const html = page(
    "Caesars",
    "#c9a227",
    `
    <div class="card">
      <div class="bet-kind">Football Teaser &middot; 6 Points &middot; 2 Legs</div>
      ${leg("Chiefs +8.5 <span style='font-size:12px;color:#909db2'>(teaser from +2.5)</span>", "-110", `Chiefs vs Raiders &bull; ${shortDate(d0)} 1:00 PM ET &bull; NFL`)}
      ${leg("Ravens -0.5 <span style='font-size:12px;color:#909db2'>(teaser from -6.5)</span>", "-110", `Ravens vs Bengals &bull; ${shortDate(d1)} 8:15 PM ET &bull; NFL`)}
      ${stakeRows(`${longDate(today)}, 9:15 AM`, "$25.00", "$45.45")}
      <div class="footer">Teaser Bet ID CZ-55218<br>Caesars Sportsbook</div>
    </div>`,
    900
  );
  targets.push({ file: "caesars-teaser.png", height: 900, html });
}

// --- 10. Negative control: not a betting slip -----------------------------------
{
  const html = page(
    "Notes",
    "#e9eef6",
    `
    <div class="card" style="background:#f5f5f4;color:#1c1917;border-color:#e7e5e4">
      <div class="bet-kind" style="color:#a8a29e">Team Standup &mdash; Week 42</div>
      <div style="font-size:15px;line-height:1.7;color:#292524">
        &bull; Shipped onboarding email sequence (3 sends)<br>
        &bull; Weekly active users up 6.2% to 1,847<br>
        &bull; Push notification open rate: 21.4%<br>
        &bull; Next sprint: referral leaderboard + bug fixes<br>
        &bull; Reminder: payroll closes on the 25th
      </div>
    </div>`,
    720,
    { navbar: false }
  );
  targets.push({ file: "notes-not-a-slip.png", height: 720, html });
}

// --- 11. Negative control: odds board (not a placed ticket) ----------------------
{
  const d1 = dateAt(1);
  const rows: string[] = [];
  const boardGames: [string, string, string, string, string, string][] = [
    [
      "Chiefs vs Raiders",
      `SD  ${shortDate(dateAt(0))} 1:00`,
      "-2.5 -110",
      "-150",
      "+130",
      "O44.5 -110",
    ],
    [
      "Bills vs Jets",
      `SD  ${shortDate(d1)} 8:15`,
      "+2.5 -105",
      "+115",
      "-135",
      "U41.5 -110",
    ],
    [
      "Packers vs Cardinals",
      `SD  ${shortDate(d1)} 4:25`,
      "-1.5 -110",
      "-120",
      "+100",
      "O47.5 -105",
    ],
  ];
  for (const [game, when, spread, ml, dog, total] of boardGames) {
    rows.push(
      `<div class="leg"><div class="leg-line"><span>${game}</span><span class="odds" style="font-size:12.5px;color:#7f8ca0">${when}</span></div>
       <div class="leg-sub">Spread ${spread} &nbsp;&bull;&nbsp; ML ${ml} / ${dog} &nbsp;&bull;&nbsp; Total ${total}</div></div>`
    );
  }
  const html = page(
    "DraftKings",
    "#53d33d",
    `
    <div class="card">
      <div class="bet-kind">NFL &mdash; Week 7 Odds</div>
      ${rows.join("\n")}
      <div class="footer">Tap any line to add it to your betslip</div>
    </div>`,
    900
  );
  targets.push({ file: "draftkings-odds-board.png", height: 900, html });
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

interface SyntheticLeg {
  subjectName: string;
  subjectType: "player" | "team" | "game";
  market: string;
  operator: string;
  targetValue: number | null;
  secondaryTargetValue?: number | null;
  description: string;
  eventDate: string;
}

interface SyntheticLabel {
  file: string;
  sourceName: string | null;
  ticketType: string;
  displayedResult: string | null;
  legs: SyntheticLeg[];
}

const labels: SyntheticLabel[] = [
  {
    displayedResult: null,
    file: "fanduel-active-parlay.png",
    legs: [
      {
        description: "Chiefs Moneyline",
        eventDate: isoDate(dateAt(0)),
        market: "team_moneyline",
        operator: "moneyline",
        subjectName: "Chiefs",
        subjectType: "team",
        targetValue: null,
      },
      {
        description: "Patrick Mahomes Over 265.5 Passing Yards",
        eventDate: isoDate(dateAt(0)),
        market: "player_passing_yards",
        operator: "over",
        subjectName: "Patrick Mahomes",
        subjectType: "player",
        targetValue: 265.5,
      },
      {
        description: "Bills -2.5",
        eventDate: isoDate(dateAt(1)),
        market: "team_spread",
        operator: "spread",
        subjectName: "Bills",
        subjectType: "team",
        targetValue: -2.5,
      },
    ],
    sourceName: "FanDuel",
    ticketType: "parlay",
  },
  {
    displayedResult: null,
    file: "draftkings-sgp-today.png",
    legs: [
      {
        description: "Luka Doncic Over 34.5 Pts+Reb+Ast",
        eventDate: isoDate(dateAt(0)),
        market: "player_points_rebounds_assists",
        operator: "over",
        subjectName: "Luka Doncic",
        subjectType: "player",
        targetValue: 34.5,
      },
      {
        description: "LeBron James Over 5.5 Assists",
        eventDate: isoDate(dateAt(0)),
        market: "player_assists",
        operator: "over",
        subjectName: "LeBron James",
        subjectType: "player",
        targetValue: 5.5,
      },
      {
        description: "Celtics Moneyline",
        eventDate: isoDate(dateAt(0)),
        market: "team_moneyline",
        operator: "moneyline",
        subjectName: "Celtics",
        subjectType: "team",
        targetValue: null,
      },
    ],
    sourceName: "DraftKings",
    ticketType: "sgp",
  },
  {
    displayedResult: "won",
    file: "fanduel-settled-won.png",
    legs: [
      {
        description: "Eagles -3.5",
        eventDate: isoDate(dateAt(-3)),
        market: "team_spread",
        operator: "spread",
        subjectName: "Eagles",
        subjectType: "team",
        targetValue: -3.5,
      },
      {
        description: "Chiefs Moneyline",
        eventDate: isoDate(dateAt(-2)),
        market: "team_moneyline",
        operator: "moneyline",
        subjectName: "Chiefs",
        subjectType: "team",
        targetValue: null,
      },
      {
        description: "Jalen Hurts Over 1.5 Passing TDs",
        eventDate: isoDate(dateAt(-3)),
        market: "player_passing_touchdowns",
        operator: "over",
        subjectName: "Jalen Hurts",
        subjectType: "player",
        targetValue: 1.5,
      },
    ],
    sourceName: "FanDuel",
    ticketType: "parlay",
  },
  {
    displayedResult: "lost",
    file: "draftkings-settled-lost.png",
    legs: [
      {
        description: "Luka Doncic Over 30.5 Points",
        eventDate: isoDate(dateAt(-1)),
        market: "player_points",
        operator: "over",
        subjectName: "Luka Doncic",
        subjectType: "player",
        targetValue: 30.5,
      },
    ],
    sourceName: "DraftKings",
    ticketType: "single",
  },
  {
    displayedResult: null,
    file: "prizepicks-entry.png",
    legs: [
      {
        description: "Shai Gilgeous-Alexander More 31.5 Points",
        eventDate: isoDate(dateAt(0)),
        market: "player_points",
        operator: "over",
        subjectName: "Shai Gilgeous-Alexander",
        subjectType: "player",
        targetValue: 31.5,
      },
      {
        description: "Nikola Jokic More 12.5 Rebounds",
        eventDate: isoDate(dateAt(1)),
        market: "player_rebounds",
        operator: "over",
        subjectName: "Nikola Jokic",
        subjectType: "player",
        targetValue: 12.5,
      },
      {
        description: "Tyrese Maxey Less 27.5 Pts+Reb+Ast",
        eventDate: isoDate(dateAt(1)),
        market: "player_points_rebounds_assists",
        operator: "under",
        subjectName: "Tyrese Maxey",
        subjectType: "player",
        targetValue: 27.5,
      },
    ],
    sourceName: "PrizePicks",
    ticketType: "parlay",
  },
  {
    displayedResult: null,
    file: "espnbet-dayof-slate.png",
    legs: [
      {
        description: "Packers -1.5",
        eventDate: isoDate(dateAt(0)),
        market: "team_spread",
        operator: "spread",
        subjectName: "Packers",
        subjectType: "team",
        targetValue: -1.5,
      },
      {
        description: "Bears vs Texans Over 44.5",
        eventDate: isoDate(dateAt(0)),
        market: "game_total",
        operator: "over",
        subjectName: "Bears vs Texans",
        subjectType: "game",
        targetValue: 44.5,
      },
      {
        description: "Lions Moneyline",
        eventDate: isoDate(dateAt(0)),
        market: "team_moneyline",
        operator: "moneyline",
        subjectName: "Lions",
        subjectType: "team",
        targetValue: null,
      },
    ],
    sourceName: "ESPN BET",
    ticketType: "parlay",
  },
  {
    displayedResult: null,
    file: "fanduel-mixed-parlay.png",
    legs: [
      {
        description: "Nuggets Moneyline",
        eventDate: isoDate(dateAt(-3)),
        market: "team_moneyline",
        operator: "moneyline",
        subjectName: "Nuggets",
        subjectType: "team",
        targetValue: null,
      },
      {
        description: "Victor Wembanyama Over 24.5 Points",
        eventDate: isoDate(dateAt(2)),
        market: "player_points",
        operator: "over",
        subjectName: "Victor Wembanyama",
        subjectType: "player",
        targetValue: 24.5,
      },
      {
        description: "Suns -4.5",
        eventDate: isoDate(dateAt(4)),
        market: "team_spread",
        operator: "spread",
        subjectName: "Suns",
        subjectType: "team",
        targetValue: -4.5,
      },
    ],
    sourceName: "FanDuel",
    ticketType: "parlay",
  },
  {
    displayedResult: null,
    file: "underdog-props.png",
    legs: [
      {
        description: "Josh Allen More 249.5 Pass+Rush Yards",
        eventDate: isoDate(dateAt(0)),
        market: "player_passing_rushing_yards",
        operator: "over",
        subjectName: "Josh Allen",
        subjectType: "player",
        targetValue: 249.5,
      },
      {
        description: "C.J. Stroud More 245.5 Passing Yards",
        eventDate: isoDate(dateAt(1)),
        market: "player_passing_yards",
        operator: "over",
        subjectName: "C.J. Stroud",
        subjectType: "player",
        targetValue: 245.5,
      },
    ],
    sourceName: "Underdog",
    ticketType: "parlay",
  },
  {
    displayedResult: null,
    file: "caesars-teaser.png",
    legs: [
      {
        description: "Chiefs +8.5 (teaser from +2.5)",
        eventDate: isoDate(dateAt(0)),
        market: "team_spread",
        operator: "spread",
        subjectName: "Chiefs",
        subjectType: "team",
        targetValue: 8.5,
      },
      {
        description: "Ravens -0.5 (teaser from -6.5)",
        eventDate: isoDate(dateAt(1)),
        market: "team_spread",
        operator: "spread",
        subjectName: "Ravens",
        subjectType: "team",
        targetValue: -0.5,
      },
    ],
    sourceName: "Caesars",
    ticketType: "teaser",
  },
  {
    displayedResult: null,
    file: "draftkings-odds-board.png",
    legs: [],
    sourceName: null,
    ticketType: "single",
  },
];

// ---------------------------------------------------------------------------
// Write + render
// ---------------------------------------------------------------------------

// On this setup, headless Chrome writes the screenshot promptly but often never
// exits, so we launch it detached, poll for the PNG, then kill the process tree.
const sleepSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const renderOne = (
  chrome: string,
  htmlPath: string,
  pngPath: string,
  profileDir: string,
  height: number
): boolean => {
  rmSync(pngPath, { force: true });
  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--hide-scrollbars",
      `--force-device-scale-factor=2`,
      `--user-data-dir=${profileDir}`,
      `--window-size=750,${height}`,
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`,
    ],
    { detached: true, stdio: "ignore" }
  );
  const deadline = Date.now() + 30_000;
  let lastSize = -1;
  while (Date.now() < deadline) {
    sleepSync(250);
    if (existsSync(pngPath)) {
      const { size } = statSync(pngPath);
      if (size > 0 && size === lastSize) {
        break;
      }
      lastSize = size;
    }
  }
  if (child.pid) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  return existsSync(pngPath) && statSync(pngPath).size > 0;
};

const renderAll = (): void => {
  const chrome = findChrome();
  mkdirSync(FIXTURES_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });
  let rendered = 0;

  for (const target of targets) {
    const htmlPath = join(TMP_DIR, `${target.file}.html`);
    const pngPath = join(FIXTURES_DIR, target.file);
    const profileDir = join(
      TMP_DIR,
      `chrome-prof-${target.file}-${Date.now()}`
    );
    writeFileSync(htmlPath, target.html);
    if (renderOne(chrome, htmlPath, pngPath, profileDir, target.height)) {
      rendered += 1;
      console.log(`rendered ${target.file}`);
    } else {
      console.warn(`FAILED to render ${target.file}`);
    }
  }
  if (rendered !== targets.length) {
    process.exitCode = 1;
  }
};

const writeLabels = (): void => {
  const labelsPath = join(FIXTURES_DIR, "labels.jsonl");
  const syntheticFiles = new Set([
    ...labels.map((label) => label.file),
    "notes-not-a-slip.png",
  ]);

  // Preserve manual entries for non-synthetic files (e.g. real screenshots).
  const preserved: string[] = [];
  if (existsSync(labelsPath)) {
    for (const line of readFileSync(labelsPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const parsed = JSON.parse(trimmed) as { file?: string };
        if (parsed.file && !syntheticFiles.has(parsed.file)) {
          preserved.push(trimmed);
        }
      } catch {
        preserved.push(trimmed);
      }
    }
  }

  const lines = [
    ...preserved,
    ...labels.map((label) => JSON.stringify(label)),
    JSON.stringify({
      displayedResult: null,
      file: "notes-not-a-slip.png",
      legs: [],
      sourceName: null,
      ticketType: "single",
    }),
  ];
  writeFileSync(labelsPath, `${lines.join("\n")}\n`);
  console.log(`wrote ${labelsPath} (${lines.length} entries)`);
};

renderAll();
writeLabels();
console.log(`\nDone. ${targets.length} synthetic fixtures in ${FIXTURES_DIR}`);
console.log(
  "Note: eventDate labels are relative to generation day; regenerate before runs far in the future."
);
