export interface SportPage {
  cardDetail: string;
  emoji: string;
  eyebrow: string;
  faq: readonly { answer: string; question: string }[];
  headline: string;
  intro: string;
  leagues: readonly string[];
  markets: readonly { description: string; name: string }[];
  metaDescription: string;
  name: string;
  relatedSlugs: readonly string[];
  slug: string;
  trackingExamples: readonly { label: string; value: string }[];
}

export const SPORT_PAGES = [
  {
    cardDetail: "NFL · NCAA · Global",
    emoji: "🏈",
    eyebrow: "Football bet tracking",
    faq: [
      {
        answer:
          "ParlayPal can follow football moneylines, spreads, totals, team markets, and player props after you confirm the extracted ticket. Feed and sportsbook availability can vary by league and market.",
        question: "What football bets can ParlayPal track?",
      },
      {
        answer:
          "Football updates can include the current score, quarter, game state, and player-stat progress. Notifications are delivered on the interval selected in your account, with milestone alerts when enabled.",
        question: "What does a football notification include?",
      },
    ],
    headline: "Track NFL and college football bets live",
    intro:
      "ParlayPal is a sportsbook-independent football bet tracker. Upload a screenshot from FanDuel, DraftKings, BetMGM, PrizePicks, or another book; confirm the extracted legs; then follow the score, quarter, and player-stat progress in one view.",
    leagues: ["NFL", "NCAA football", "International football"],
    markets: [
      {
        description: "See whether your team is ahead at the final whistle.",
        name: "Moneyline",
      },
      {
        description: "Follow the score against the spread as the game moves.",
        name: "Point spread",
      },
      {
        description: "Track points against the game or team total.",
        name: "Game and team totals",
      },
      {
        description: "Follow passing, rushing, receiving, and touchdown legs.",
        name: "Player props",
      },
    ],
    metaDescription:
      "Track NFL and NCAA football bets from any sportsbook. Follow scores, quarters, spreads, moneylines, totals, and player props with scheduled live updates.",
    name: "Football",
    relatedSlugs: ["basketball", "baseball", "hockey"],
    slug: "football",
    trackingExamples: [
      { label: "Chiefs moneyline", value: "Current score · Q3" },
      { label: "Mahomes passing yards", value: "188 / 275.5" },
      { label: "Anytime touchdown", value: "Scored · Won" },
    ],
  },
  {
    cardDetail: "NBA · WNBA · NCAA · Global",
    emoji: "🏀",
    eyebrow: "Basketball bet tracking",
    faq: [
      {
        answer:
          "ParlayPal follows basketball moneylines, spreads, totals, team markets, and player props such as points, rebounds, assists, threes, and combined-stat lines when the live feed supports them.",
        question: "Can ParlayPal track basketball player props?",
      },
      {
        answer:
          "A basketball update can show the score, quarter, player box-score progress, and which legs have already cleared. Your notification interval controls how often scheduled updates are sent.",
        question: "How are basketball parlays updated?",
      },
    ],
    headline: "Follow every NBA, WNBA, and NCAA basketball leg",
    intro:
      "Basketball lines change quickly, and a parlay can depend on one player’s next rebound or three. ParlayPal reads the slip, matches each selection to live game data, and gives you a single progress view for player props, team markets, and the final result.",
    leagues: ["NBA", "WNBA", "NCAA basketball", "International basketball"],
    markets: [
      {
        description:
          "Follow the team result from tipoff through the final horn.",
        name: "Moneyline and spread",
      },
      {
        description: "Track points by quarter and over/under progress.",
        name: "Game totals",
      },
      {
        description: "See points, rebounds, assists, and threes accumulate.",
        name: "Player props",
      },
      {
        description: "Combine points, rebounds, and assists in one leg.",
        name: "Combo props",
      },
    ],
    metaDescription:
      "Track NBA, WNBA, and NCAA basketball bets live. Follow player points, rebounds, assists, threes, combo props, spreads, moneylines, and totals.",
    name: "Basketball",
    relatedSlugs: ["football", "hockey", "baseball"],
    slug: "basketball",
    trackingExamples: [
      { label: "Player threes", value: "3 / 4.5" },
      { label: "Points + rebounds + assists", value: "30 / 30" },
      { label: "Team moneyline", value: "Score · Q4" },
    ],
  },
  {
    cardDetail: "MLB · Global",
    emoji: "⚾",
    eyebrow: "Baseball bet tracking",
    faq: [
      {
        answer:
          "ParlayPal can track baseball moneylines, run lines, totals, team markets, and supported batter or pitcher props after you review the extracted legs.",
        question: "What baseball markets are supported?",
      },
      {
        answer:
          "Baseball notifications can summarize the score, inning, game state, and supported player-stat progress. Updates follow your selected notification schedule rather than requiring you to keep the app open.",
        question: "What does a baseball live update show?",
      },
    ],
    headline: "Keep every baseball bet on the scoreboard",
    intro:
      "Baseball bets unfold one plate appearance at a time. ParlayPal turns a screenshot of your MLB or other baseball ticket into a readable tracker for the game score, inning, run line, totals, and the player props that decide your parlay.",
    leagues: ["MLB", "MiLB", "International baseball"],
    markets: [
      {
        description: "See the current result and final winner.",
        name: "Moneyline",
      },
      {
        description: "Follow runs against the line as innings finish.",
        name: "Run line",
      },
      {
        description: "Track runs by inning toward the game total.",
        name: "Game totals",
      },
      {
        description: "Follow supported hitter and pitcher statistics.",
        name: "Player props",
      },
    ],
    metaDescription:
      "Track MLB and baseball bets live from any sportsbook. Follow innings, scores, moneylines, run lines, totals, and supported batter or pitcher props.",
    name: "Baseball",
    relatedSlugs: ["football", "basketball", "hockey"],
    slug: "baseball",
    trackingExamples: [
      { label: "Yankees moneyline", value: "NY 4 · BOS 3 · 7th" },
      { label: "Team total", value: "4 / 5.5 runs" },
      { label: "Batter hits", value: "1 / 2" },
    ],
  },
  {
    cardDetail: "NHL · Global",
    emoji: "🏒",
    eyebrow: "Hockey bet tracking",
    faq: [
      {
        answer:
          "ParlayPal follows hockey moneylines, puck lines, totals, team markets, and supported player props. Available markets depend on the ticket and live data coverage.",
        question: "Can ParlayPal track hockey parlays?",
      },
      {
        answer:
          "Hockey updates can include the score, period, overtime state, and supported player-stat progress. You choose the notification interval that fits your plan and preferences.",
        question: "What hockey information is sent?",
      },
    ],
    headline: "Follow NHL scores, periods, and player props",
    intro:
      "Hockey moves fast, but your bet slip should still be easy to read. ParlayPal connects each NHL or hockey selection to its game, then keeps score, period, puck-line, total, and player-prop progress together as the action unfolds.",
    leagues: ["NHL", "AHL", "International hockey"],
    markets: [
      {
        description: "Track the winner through regulation and overtime.",
        name: "Moneyline",
      },
      {
        description: "Follow the puck line with the live score.",
        name: "Puck line",
      },
      {
        description: "See goals accumulate toward the game total.",
        name: "Game totals",
      },
      {
        description: "Follow supported shots, points, and goals props.",
        name: "Player props",
      },
    ],
    metaDescription:
      "Track NHL and hockey bets live. Follow scores, periods, puck lines, moneylines, totals, and supported player props in one parlay tracker.",
    name: "Hockey",
    relatedSlugs: ["basketball", "football", "soccer"],
    slug: "hockey",
    trackingExamples: [
      { label: "Rangers moneyline", value: "NYR 2 · NJ 1 · P2" },
      { label: "Game total", value: "3 / 6.5 goals" },
      { label: "Player shots", value: "4 / 5.5" },
    ],
  },
  {
    cardDetail: "International Leagues",
    emoji: "⚽",
    eyebrow: "Soccer bet tracking",
    faq: [
      {
        answer:
          "ParlayPal can track supported soccer moneylines, draw-no-bet or result markets, totals, team markets, and player props after you confirm the ticket.",
        question: "What soccer bets can I track?",
      },
      {
        answer:
          "Soccer updates can show the score, match minute, halftime or full-time state, and supported player or team progress. Notification timing follows the interval selected in your account.",
        question: "Do soccer updates include the match minute?",
      },
    ],
    headline: "Track soccer bets from kickoff to full time",
    intro:
      "Soccer markets depend on a small number of decisive moments. ParlayPal organizes your soccer ticket by match, tracks score and match state, and keeps supported result, total, team, and player selections readable from kickoff through full time.",
    leagues: [
      "Premier League",
      "MLS",
      "UEFA competitions",
      "International soccer",
    ],
    markets: [
      {
        description:
          "Follow the match result, including supported draw markets.",
        name: "Match result",
      },
      {
        description: "Track goals against the match total.",
        name: "Goals totals",
      },
      {
        description: "Follow team goals and supported team outcomes.",
        name: "Team markets",
      },
      {
        description: "Track supported shots, goals, and assists props.",
        name: "Player props",
      },
    ],
    metaDescription:
      "Track soccer bets live from any sportsbook. Follow match scores, minutes, result markets, goal totals, team markets, and supported player props.",
    name: "Soccer",
    relatedSlugs: ["hockey", "football", "tennis"],
    slug: "soccer",
    trackingExamples: [
      { label: "Match result", value: "2 · 1 · 68'" },
      { label: "Over 2.5 goals", value: "3 goals · Won" },
      { label: "Player shots", value: "2 / 3" },
    ],
  },
  {
    cardDetail: "UFC",
    emoji: "🥊",
    eyebrow: "MMA bet tracking",
    faq: [
      {
        answer:
          "ParlayPal can track supported MMA moneylines, method-of-victory markets, round totals, and fighter props after the ticket is confirmed.",
        question: "Can ParlayPal track MMA bets?",
      },
      {
        answer:
          "MMA notifications can show the bout status, round, result state, and supported fighter-stat progress. The exact detail depends on the live data available for the event.",
        question: "What does an MMA notification contain?",
      },
    ],
    headline: "Keep every MMA fight and prop in view",
    intro:
      "MMA parlays often combine several fights, methods, and round markets on one ticket. ParlayPal reads those legs, groups them by bout, and shows whether each selection is scheduled, live, won, or still waiting on the official result.",
    leagues: ["UFC", "MMA events", "Supported fight promotions"],
    markets: [
      {
        description: "Follow the fighter result as the bout is decided.",
        name: "Fight moneyline",
      },
      {
        description:
          "Track supported knockout, submission, and decision markets.",
        name: "Method of victory",
      },
      {
        description: "Follow whether a bout reaches the listed round total.",
        name: "Round totals",
      },
      {
        description: "Track supported strike, takedown, or round props.",
        name: "Fighter props",
      },
    ],
    metaDescription:
      "Track UFC and supported MMA bets live. Follow fight moneylines, method-of-victory markets, round totals, and fighter props from one ticket view.",
    name: "MMA",
    relatedSlugs: ["tennis", "football", "soccer"],
    slug: "mma",
    trackingExamples: [
      { label: "Fight moneyline", value: "Live · Round 2" },
      { label: "Over 1.5 rounds", value: "Round 2 · Live" },
      { label: "Method of victory", value: "Pending result" },
    ],
  },
  {
    cardDetail: "ATP · WTA",
    emoji: "🎾",
    eyebrow: "Tennis bet tracking",
    faq: [
      {
        answer:
          "ParlayPal can track supported tennis match winners, set or game handicaps, totals, and player props after you review the extracted ticket.",
        question: "What tennis markets can ParlayPal follow?",
      },
      {
        answer:
          "Tennis updates can include the set and game score, match status, and supported player-stat progress. Notifications are sent using your chosen schedule.",
        question: "Do tennis updates show the set score?",
      },
    ],
    headline: "Follow tennis matches set by set",
    intro:
      "Tennis parlays can turn on a single break point or set. ParlayPal connects each selection to the match, follows the set and game score, and gives you a clear status for match winners, handicaps, totals, and supported player props.",
    leagues: ["ATP", "WTA", "Grand Slam events", "International tennis"],
    markets: [
      {
        description: "Follow the match winner through the final set.",
        name: "Match winner",
      },
      {
        description: "Track sets or games against the listed handicap.",
        name: "Set and game handicap",
      },
      {
        description: "Follow games or sets toward the match total.",
        name: "Match totals",
      },
      {
        description: "Track supported aces and match-stat props.",
        name: "Player props",
      },
    ],
    metaDescription:
      "Track ATP, WTA, and tennis bets live. Follow match winners, set and game handicaps, totals, scores, and supported player props.",
    name: "Tennis",
    relatedSlugs: ["soccer", "mma", "basketball"],
    slug: "tennis",
    trackingExamples: [
      { label: "Match winner", value: "Set 2 · 4–3" },
      { label: "Player aces", value: "7 / 8.5" },
      { label: "Games total", value: "18 / 22.5" },
    ],
  },
  {
    cardDetail: "NASCAR · Formula 1",
    emoji: "🏎️",
    eyebrow: "Racing bet tracking",
    faq: [
      {
        answer:
          "ParlayPal can track supported racing winner, podium, matchup, finishing-position, and race-total markets after the ticket is confirmed.",
        question: "What racing bets does ParlayPal track?",
      },
      {
        answer:
          "Racing updates can show lap or stage progress, position, caution or pit state when available, and the current status of each selection. Delivery follows your chosen interval.",
        question: "What can a racing update show?",
      },
    ],
    headline: "Track racing positions, laps, and finish markets",
    intro:
      "Racing bets are about position over time, not just a final score. ParlayPal organizes motorsport tickets around the event, follows available lap, stage, and position data, and keeps winner, podium, matchup, and finishing-position legs easy to scan.",
    leagues: ["NASCAR", "Formula 1", "IndyCar", "Global motorsport"],
    markets: [
      {
        description: "Follow the leader and your selected winner.",
        name: "Race winner",
      },
      {
        description: "Track podium and finishing-position outcomes.",
        name: "Podium and finish",
      },
      {
        description: "Compare drivers or entrants through the event.",
        name: "Head-to-head matchup",
      },
      {
        description: "Follow supported stage, lap, and event totals.",
        name: "Race props",
      },
    ],
    metaDescription:
      "Track NASCAR, Formula 1, IndyCar, and motorsport bets live. Follow positions, laps, stages, winners, podiums, matchups, and finish markets.",
    name: "Racing",
    relatedSlugs: ["golf", "tennis", "football"],
    slug: "racing",
    trackingExamples: [
      { label: "Race winner", value: "P1 · Lap 42 / 70" },
      { label: "Driver matchup", value: "Ahead · Live" },
      { label: "Top-5 finish", value: "P4 · Live" },
    ],
  },
  {
    cardDetail: "PGA · LIV",
    emoji: "⛳",
    eyebrow: "Golf bet tracking",
    faq: [
      {
        answer:
          "ParlayPal can track supported golf winner, top-finish, matchup, round, and tournament markets after you verify the ticket.",
        question: "What golf bets can ParlayPal follow?",
      },
      {
        answer:
          "Golf updates can include a player’s position, score relative to par, round, and supported tournament progress. Exact coverage depends on the event feed.",
        question: "What does a golf update show?",
      },
    ],
    headline: "Follow golf positions from first tee to final round",
    intro:
      "Golf tickets can stay live across four rounds and dozens of players. ParlayPal turns your screenshot into an event-aware tracker for leaderboard position, score relative to par, player matchups, top finishes, and supported round or tournament markets.",
    leagues: ["PGA Tour", "LIV Golf", "LPGA", "Major championships"],
    markets: [
      {
        description: "Follow the player or team at the top of the board.",
        name: "Tournament winner",
      },
      {
        description: "Track a player’s current place and finish range.",
        name: "Top finish",
      },
      {
        description: "Compare two golfers throughout the tournament.",
        name: "Player matchup",
      },
      {
        description: "Follow round and tournament score markets.",
        name: "Round and tournament props",
      },
    ],
    metaDescription:
      "Track PGA, LIV, LPGA, and golf bets live. Follow leaderboard position, score to par, tournament winners, top finishes, matchups, and round markets.",
    name: "Golf",
    relatedSlugs: ["racing", "tennis", "baseball"],
    slug: "golf",
    trackingExamples: [
      { label: "Tournament winner", value: "T8 · Round 3" },
      { label: "Top-10 finish", value: "T8 · Live" },
      { label: "Player score", value: "−4 · 12 holes" },
    ],
  },
] as const satisfies readonly SportPage[];

export const getSportPage = (slug: string): SportPage | undefined =>
  SPORT_PAGES.find((page) => page.slug === slug);
