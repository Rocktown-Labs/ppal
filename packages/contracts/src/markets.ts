export const marketDefinitions = {
  finish_position: { name: "Finish Position", statKeys: ["position"] },
  game_total: { name: "Game Total", statKeys: [] },
  leaderboard_position: {
    name: "Leaderboard Position",
    statKeys: ["position"],
  },
  player_aces: { name: "Player Aces", statKeys: ["aces"] },
  player_assists: { name: "Player Assists", statKeys: ["assists"] },
  player_breakpoints_won: {
    name: "Player Break Points Won",
    statKeys: ["break_points_won"],
  },
  player_double_faults: {
    name: "Player Double Faults",
    statKeys: ["double_faults"],
  },
  player_goals: { name: "Player Goals", statKeys: ["goals"] },
  player_goals_scored: {
    name: "Player Goals Scored",
    statKeys: ["goals_scored", "goals"],
  },
  player_hits: { name: "Player Hits", statKeys: ["hits", "h"] },
  player_home_runs: {
    name: "Player Home Runs",
    statKeys: ["home_runs", "hr"],
  },
  player_knockdowns: {
    name: "Player Knockdowns",
    statKeys: ["knockdowns"],
  },
  player_passing_rushing_yards: {
    name: "Player Passing + Rushing Yards",
    statKeys: [],
  },
  player_passing_touchdowns: {
    name: "Player Passing Touchdowns",
    statKeys: ["passing_touchdowns"],
  },
  player_passing_yards: {
    name: "Player Passing Yards",
    statKeys: ["passing_yards"],
  },
  player_points: { name: "Player Points", statKeys: ["points"] },
  player_points_assists: {
    name: "Player Points + Assists",
    statKeys: [],
  },
  player_points_rebounds: {
    name: "Player Points + Rebounds",
    statKeys: [],
  },
  player_points_rebounds_assists: {
    name: "Player Points + Rebounds + Assists",
    statKeys: [],
  },
  player_rbi: { name: "Player RBI", statKeys: ["rbi"] },
  player_rebounds: { name: "Player Rebounds", statKeys: ["rebounds"] },
  player_rebounds_assists: {
    name: "Player Rebounds + Assists",
    statKeys: [],
  },
  player_receiving_yards: {
    name: "Player Receiving Yards",
    statKeys: ["receiving_yards"],
  },
  player_runs: { name: "Player Runs", statKeys: ["runs", "total"] },
  player_rushing_yards: {
    name: "Player Rushing Yards",
    statKeys: ["rushing_yards"],
  },
  player_shots: { name: "Player Shots", statKeys: ["shots"] },
  player_shots_on_target: {
    name: "Player Shots on Target",
    statKeys: ["shots_on_target"],
  },
  player_significant_strikes: {
    name: "Player Significant Strikes",
    statKeys: ["significant_strikes"],
  },
  player_takedowns: {
    name: "Player Takedowns",
    statKeys: ["takedowns"],
  },
  player_three_pointers_made: {
    name: "Player Three-Pointers Made",
    statKeys: ["three_points_made"],
  },
  player_total_shots: {
    name: "Player Total Shots",
    statKeys: ["points_won"],
  },
  race_winner: { name: "Race Winner", statKeys: ["position"] },
  team_moneyline: { name: "Team Moneyline", statKeys: [] },
  team_spread: { name: "Team Spread", statKeys: [] },
  tournament_winner: {
    name: "Tournament Winner",
    statKeys: ["position"],
  },
} as const;

export type SupportedMarketSlug = keyof typeof marketDefinitions;

export const supportedMarketSlugs = Object.keys(
  marketDefinitions
) as SupportedMarketSlug[];
