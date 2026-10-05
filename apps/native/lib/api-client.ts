import { createClient, type InferResponseType } from "@ppal/api";
import { env } from "@ppal/env/native";
import { useQuery } from "@tanstack/react-query";

import {
  DEMO_USER_EMAIL,
  isDemoUser,
  useAppState,
} from "@/lib/app-state";
import { authClient } from "@/lib/auth-client";

/**
 * Fetch wrapper that attaches the better-auth session cookie from the
 * @better-auth/expo SecureStore jar to every RPC call so authenticated
 * endpoints resolve the session on native, where fetch has no cookie jar.
 */
const sessionCookieFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  try {
    const cookie = await authClient.getCookie();
    if (cookie && !headers.has("cookie")) {
      headers.set("cookie", cookie);
    }
  } catch {
    // No stored session yet; the request proceeds unauthenticated.
  }
  return fetch(input, { ...init, headers });
};

// Typed Hono RPC client pointing at EXPO_PUBLIC_SERVER_URL. Request and
// response shapes are inferred from the server's exported AppType.
export const client = createClient(env.EXPO_PUBLIC_SERVER_URL, {
  fetch: sessionCookieFetch,
});

type TicketsPayload = InferResponseType<
  typeof client.api.v1.tickets.$get,
  200
>;
type NotificationsPayload = InferResponseType<
  typeof client.api.v1.notifications.$get,
  200
>;
type MePayload = InferResponseType<typeof client.api.v1.me.$get, 200>;
type CommunityDetailPayload = InferResponseType<
  (typeof client.api.v1.communities)[":slug"]["$get"],
  200
>;
type ChannelMessagesPayload = InferResponseType<
  (typeof client.api.v1.communities)[":slug"]["channels"][":channelId"]["messages"]["$get"],
  200
>;
type JoinedCommunitiesPayload = InferResponseType<
  typeof client.api.v1.communities.$get,
  200
>;
type PublicCommunitiesPayload = InferResponseType<
  typeof client.api.v1.communities.public.$get,
  200
>;

export interface MobileLeg {
  currentValue: number;
  id: string;
  lostAt?: string | null;
  marketDescription: string;
  operator: string;
  rawDescription: string;
  status: "won" | "lost" | "live" | "pending";
  subjectName: string;
  targetValue: number;
  timeRemaining?: string;
  wonAt?: string | null;
}

export interface MobileTicket {
  cashoutOffer?: number;
  createdAt: string;
  id: string;
  legs: MobileLeg[];
  odds: string;
  originalStake: number;
  sourceName: string;
  sportsEvent: string;
  status: "live" | "won" | "lost" | "scheduled" | "needs_review";
  ticketType: "parlay" | "sgp" | "single";
  verificationStatus: "verified" | "unverified";
}

export interface MobileMetrics {
  activeTicketsCount: number;
  activeValueAtRisk: number;
  cashedTicketsCount: number;
  netProfitUnits: string;
  streak: number;
  winRatePercent: number;
}

export interface MobileNotification {
  body: string;
  category:
    | "leg_hit"
    | "cashout"
    | "ticket_won"
    | "ticket_lost"
    | "game_start"
    | "mention";
  createdAt: string;
  id: string;
  read: boolean;
  ticketId: string;
  title: string;
}

export interface MobileProfile {
  antiFraudVerified: boolean;
  avatarUrl?: string;
  handle: string;
  lossesCount: number;
  memberSince: string;
  name: string;
  roiUnits: string;
  sportsBreakdown: Array<{ percent: number; sport: string }>;
  totalBetsTracked: number;
  winRatePercent: number;
  winsCount: number;
}

// High-fidelity fallback fixtures for offline/demo resilience
export const MOCK_TICKETS: MobileTicket[] = [
  {
    cashoutOffer: 210.5,
    createdAt: new Date().toISOString(),
    id: "tkt_live_01",
    legs: [
      {
        currentValue: 28,
        id: "leg_1",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 26.5 Points",
        status: "won",
        subjectName: "Jayson Tatum",
        targetValue: 26.5,
        wonAt: "3Q 1:44",
      },
      {
        currentValue: 3,
        id: "leg_2",
        marketDescription: "Made 3-Point Field Goals",
        operator: "over",
        rawDescription: "Over 1.5 Made 3PT",
        status: "won",
        subjectName: "Derrick White",
        targetValue: 1.5,
        wonAt: "2Q 4:10",
      },
      {
        currentValue: 8,
        id: "leg_3",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 9.5 Assists",
        status: "live",
        subjectName: "Tyrese Haliburton",
        targetValue: 9.5,
        timeRemaining: "4Q 4:12",
      },
      {
        currentValue: 4,
        id: "leg_4",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 6.5 Rebounds",
        status: "live",
        subjectName: "Myles Turner",
        targetValue: 6.5,
        timeRemaining: "4Q 4:12",
      },
    ],
    odds: "+420",
    originalStake: 50,
    sourceName: "DraftKings",
    sportsEvent: "BOS Celtics @ IND Pacers",
    status: "live",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    id: "tkt_sched_02",
    legs: [
      {
        currentValue: 0,
        id: "leg_5",
        marketDescription: "Pass TDs",
        operator: "over",
        rawDescription: "Over 1.5 Pass TDs",
        status: "pending",
        subjectName: "Patrick Mahomes",
        targetValue: 1.5,
      },
      {
        currentValue: 0,
        id: "leg_6",
        marketDescription: "Receiving Yards",
        operator: "over",
        rawDescription: "Over 68.5 Rec Yds",
        status: "pending",
        subjectName: "Travis Kelce",
        targetValue: 68.5,
      },
      {
        currentValue: 0,
        id: "leg_7",
        marketDescription: "Moneyline",
        operator: "over",
        rawDescription: "KC Chiefs ML",
        status: "pending",
        subjectName: "KC Chiefs",
        targetValue: 1,
      },
    ],
    odds: "+275",
    originalStake: 70,
    sourceName: "FanDuel",
    sportsEvent: "KC Chiefs @ BUF Bills",
    status: "scheduled",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: 145.0,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    id: "tkt_live_02",
    legs: [
      {
        currentValue: 32,
        id: "leg_8",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 30.5 Points",
        status: "won",
        subjectName: "Giannis Antetokounmpo",
        targetValue: 30.5,
        wonAt: "4Q 8:12",
      },
      {
        currentValue: 22,
        id: "leg_9",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 24.5 Points",
        status: "live",
        subjectName: "Tyrese Maxey",
        targetValue: 24.5,
        timeRemaining: "4Q 3:45",
      },
      {
        currentValue: 8,
        id: "leg_10",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 7.5 Assists",
        status: "won",
        subjectName: "Damian Lillard",
        targetValue: 7.5,
        wonAt: "4Q 5:20",
      },
    ],
    odds: "+310",
    originalStake: 40,
    sourceName: "BetMGM",
    sportsEvent: "MIL Bucks @ PHI 76ers",
    status: "live",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    id: "tkt_sched_03",
    legs: [
      {
        currentValue: 0,
        id: "leg_11",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 31.5 Points",
        status: "pending",
        subjectName: "Luka Doncic",
        targetValue: 31.5,
      },
      {
        currentValue: 0,
        id: "leg_12",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 7.5 Assists",
        status: "pending",
        subjectName: "LeBron James",
        targetValue: 7.5,
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "DraftKings",
    sportsEvent: "DAL Mavericks @ LAL Lakers",
    status: "scheduled",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    id: "tkt_settled_1",
    legs: [
      {
        currentValue: 29,
        id: "sleg_1",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 26.5 Points",
        status: "won",
        subjectName: "Jayson Tatum",
        targetValue: 26.5,
        wonAt: "Final",
      },
      {
        currentValue: 4,
        id: "sleg_2",
        marketDescription: "Made 3PT",
        operator: "over",
        rawDescription: "Over 2.5 Made 3PT",
        status: "won",
        subjectName: "Jaylen Brown",
        targetValue: 2.5,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "DraftKings",
    sportsEvent: "BOS Celtics @ MIA Heat",
    status: "won",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    id: "tkt_settled_2",
    legs: [
      {
        currentValue: 31,
        id: "sleg_3",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 27.5 Points",
        status: "won",
        subjectName: "Steph Curry",
        targetValue: 27.5,
        wonAt: "Final",
      },
      {
        currentValue: 8,
        id: "sleg_4",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 6.5 Assists",
        status: "won",
        subjectName: "Chris Paul",
        targetValue: 6.5,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "FanDuel",
    sportsEvent: "GS Warriors @ LAL Lakers",
    status: "won",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    id: "tkt_settled_3",
    legs: [
      {
        currentValue: 22,
        id: "sleg_5",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 25.5 Points",
        status: "lost",
        subjectName: "Devin Booker",
        targetValue: 25.5,
      },
      {
        currentValue: 12,
        id: "sleg_6",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 10.5 Rebounds",
        status: "won",
        subjectName: "Jusuf Nurkic",
        targetValue: 10.5,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "BetMGM",
    sportsEvent: "PHX Suns @ DEN Nuggets",
    status: "lost",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    id: "tkt_settled_4",
    legs: [
      {
        currentValue: 3,
        id: "sleg_7",
        marketDescription: "Pass TDs",
        operator: "over",
        rawDescription: "Over 1.5 Pass TDs",
        status: "won",
        subjectName: "Patrick Mahomes",
        targetValue: 1.5,
        wonAt: "Final",
      },
      {
        currentValue: 84,
        id: "sleg_8",
        marketDescription: "Receiving Yards",
        operator: "over",
        rawDescription: "Over 64.5 Rec Yds",
        status: "won",
        subjectName: "Travis Kelce",
        targetValue: 64.5,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "FanDuel",
    sportsEvent: "KC Chiefs @ LAC Chargers",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    id: "tkt_settled_5",
    legs: [
      {
        currentValue: 11,
        id: "sleg_9",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 9.5 Assists",
        status: "won",
        subjectName: "Tyrese Haliburton",
        targetValue: 9.5,
        wonAt: "Final",
      },
      {
        currentValue: 24,
        id: "sleg_10",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 19.5 Points",
        status: "won",
        subjectName: "Pascal Siakam",
        targetValue: 19.5,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "DraftKings",
    sportsEvent: "IND Pacers @ NY Knicks",
    status: "won",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    id: "tkt_settled_6",
    legs: [
      {
        currentValue: 34,
        id: "sleg_11",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 30.5 Points",
        status: "won",
        subjectName: "Giannis Antetokounmpo",
        targetValue: 30.5,
        wonAt: "Final",
      },
      {
        currentValue: 13,
        id: "sleg_12",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 11.5 Rebounds",
        status: "won",
        subjectName: "Giannis Antetokounmpo",
        targetValue: 11.5,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "Caesars",
    sportsEvent: "MIL Bucks @ CHI Bulls",
    status: "won",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    id: "tkt_settled_7",
    legs: [
      {
        currentValue: 18,
        id: "sleg_13",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 22.5 Points",
        status: "lost",
        subjectName: "Anthony Edwards",
        targetValue: 22.5,
      },
      {
        currentValue: 11,
        id: "sleg_14",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 12.5 Rebounds",
        status: "lost",
        subjectName: "Rudy Gobert",
        targetValue: 12.5,
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "FanDuel",
    sportsEvent: "MIN Timberwolves @ DAL Mavericks",
    status: "lost",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    id: "tkt_settled_8",
    legs: [
      {
        currentValue: 32,
        id: "sleg_15",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 28.5 Points",
        status: "won",
        subjectName: "Shai Gilgeous-Alexander",
        targetValue: 28.5,
        wonAt: "Final",
      },
      {
        currentValue: 8,
        id: "sleg_16",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 6.5 Assists",
        status: "won",
        subjectName: "Jalen Williams",
        targetValue: 6.5,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "DraftKings",
    sportsEvent: "OKC Thunder @ HOU Rockets",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 9).toISOString(),
    id: "tkt_settled_9",
    legs: [
      {
        currentValue: 210,
        id: "sleg_17",
        marketDescription: "Passing Yards",
        operator: "over",
        rawDescription: "Over 245.5 Pass Yds",
        status: "lost",
        subjectName: "Josh Allen",
        targetValue: 245.5,
      },
      {
        currentValue: 2,
        id: "sleg_18",
        marketDescription: "Rush TDs",
        operator: "over",
        rawDescription: "1+ Any Time TD",
        status: "won",
        subjectName: "James Cook",
        targetValue: 1,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "BetMGM",
    sportsEvent: "BUF Bills @ NY Jets",
    status: "lost",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    cashoutOffer: undefined,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    id: "tkt_settled_10",
    legs: [
      {
        currentValue: 35,
        id: "sleg_19",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 31.5 Points",
        status: "won",
        subjectName: "Luka Doncic",
        targetValue: 31.5,
        wonAt: "Final",
      },
      {
        currentValue: 10,
        id: "sleg_20",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 8.5 Rebounds",
        status: "won",
        subjectName: "Luka Doncic",
        targetValue: 8.5,
        wonAt: "Final",
      },
    ],
    odds: "",
    originalStake: 0,
    sourceName: "DraftKings",
    sportsEvent: "DAL Mavericks @ PHX Suns",
    status: "won",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
];

export const MOCK_METRICS: MobileMetrics = {
  activeTicketsCount: 2,
  activeValueAtRisk: 120,
  cashedTicketsCount: 14,
  netProfitUnits: "+24.8u",
  streak: 3,
  winRatePercent: 68.4,
};

export const MOCK_NOTIFICATIONS: MobileNotification[] = [
  {
    body: "Cleared 26.5 points with a corner 3-pointer in 3Q. Leg settled as WON.",
    category: "leg_hit",
    createdAt: "2m ago",
    id: "notif_1",
    read: false,
    ticketId: "tkt_live_01",
    title: "Leg Hit: Jayson Tatum Over 26.5 Pts",
  },
  {
    body: "DraftKings SGP cashout offer available. All legs currently tracking positive.",
    category: "cashout",
    createdAt: "12m ago",
    id: "notif_2",
    read: false,
    ticketId: "tkt_live_01",
    title: "Cashout Alert: Early Cashout Available",
  },
  {
    body: "Derrick White made his 3rd three-pointer. Leg settled as WON.",
    category: "leg_hit",
    createdAt: "28m ago",
    id: "notif_3",
    read: true,
    ticketId: "tkt_live_01",
    title: "Leg Hit: Derrick White 2+ Threes",
  },
  {
    body: "Boston Celtics @ Indiana Pacers has tipped off at Gainbridge Fieldhouse.",
    category: "game_start",
    createdAt: "1h ago",
    id: "notif_4",
    read: true,
    ticketId: "tkt_live_01",
    title: "Game Live: BOS @ IND",
  },
  {
    body: "Your 3-Leg MLB Parlay from yesterday settled as WON. All legs verified.",
    category: "ticket_won",
    createdAt: "Yesterday",
    id: "notif_5",
    read: true,
    ticketId: "tkt_settled_1",
    title: "Ticket Cashed: 3/3 Legs Won",
  },
];

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return value.toString();
}

export interface SportsbookStat {
  id: string;
  lost: number;
  name: string;
  tickets: Array<{
    date: string;
    event: string;
    id: string;
    odds: string;
    stake: number;
    status: "won" | "lost" | "live";
    type: string;
  }>;
  total: number;
  winRate: number;
  won: number;
}

export interface PlayerStatBet {
  actualValue: string;
  date: string;
  id: string;
  line: string;
  market: string;
  matchup: string;
  odds: string;
  operator: "over" | "under";
  prop: string;
  status: "won" | "lost" | "live";
  targetValue: number;
}

export interface PlayerStat {
  bets: PlayerStatBet[];
  hitRate: number;
  id: string;
  lost: number;
  name: string;
  selections: number;
  sport: string;
  team: string;
  won: number;
}

export interface CommunityMessageItem {
  authorAvatar?: string;
  authorHandle: string;
  authorName: string;
  content: string;
  id: string;
  isCreator?: boolean;
  lastReplyTime?: string;
  reactions: Array<{ count: number; emoji: string; mine?: boolean }>;
  replies?: CommunityMessageItem[];
  repliesCount?: number;
  roleBadge?: "AGENT" | "CREATOR" | "VIP" | "ADMIN" | "MEMBER";
  ticketAttachment?: {
    id: string;
    legsCount: number;
    odds: string;
    summary: string;
  };
  timestamp: string;
}

export interface CommunityChannelItem {
  id: string;
  name: string;
  unreadCount?: number;
}

export interface CommunityDetail {
  channels: CommunityChannelItem[];
  /** Cursor-pagination state per channel; present only when set to "load earlier". */
  cursors?: Record<string, string | null>;
  description: string;
  id: string;
  isCreator: boolean;
  memberCount: number;
  messages: Record<string, CommunityMessageItem[]>;
  name: string;
  onlineCount: number;
  pinnedSlip?: {
    creator: string;
    id: string;
    legs: Array<{
      line: string;
      status: "won" | "live" | "lost";
      subject: string;
    }>;
    odds: string;
    stake: number;
    title: string;
  };
  slug: string;
}

export const MOCK_SPORTSBOOKS: SportsbookStat[] = [
  {
    id: "draftkings",
    lost: 14,
    name: "DraftKings",
    tickets: [
      {
        date: "Today, 7:10 PM",
        event: "BOS Celtics @ IND Pacers",
        id: "tkt_1",
        odds: "+420",
        stake: 50,
        status: "live",
        type: "4-Leg SGP",
      },
      {
        date: "Yesterday",
        event: "MIL Bucks @ MIA Heat",
        id: "tkt_2",
        odds: "+310",
        stake: 75,
        status: "won",
        type: "3-Leg SGP",
      },
      {
        date: "Sep 26",
        event: "DEN Nuggets @ LAL Lakers",
        id: "tkt_3",
        odds: "+550",
        stake: 25,
        status: "lost",
        type: "5-Leg Parlay",
      },
    ],
    total: 48,
    winRate: 70.8,
    won: 34,
  },
  {
    id: "fanduel",
    lost: 18,
    name: "FanDuel",
    tickets: [
      {
        date: "Sunday, 1:00 PM",
        event: "KC Chiefs @ BUF Bills",
        id: "tkt_4",
        odds: "+275",
        stake: 70,
        status: "live",
        type: "3-Leg Parlay",
      },
      {
        date: "Sep 25",
        event: "NY Liberty @ MIN Lynx",
        id: "tkt_5",
        odds: "+240",
        stake: 60,
        status: "won",
        type: "2-Leg SGP",
      },
    ],
    total: 56,
    winRate: 67.9,
    won: 38,
  },
  {
    id: "betmgm",
    lost: 8,
    name: "BetMGM",
    tickets: [
      {
        date: "Sep 24",
        event: "BAL Orioles @ NY Yankees",
        id: "tkt_6",
        odds: "+340",
        stake: 40,
        status: "won",
        type: "3-Leg Parlay",
      },
      {
        date: "Sep 22",
        event: "PHI Phillies @ NY Mets",
        id: "tkt_7",
        odds: "",
        stake: 0,
        status: "lost",
        type: "Moneyline Parlay",
      },
    ],
    total: 26,
    winRate: 69.2,
    won: 18,
  },
  {
    id: "caesars",
    lost: 5,
    name: "Caesars",
    tickets: [
      {
        date: "Sep 20",
        event: "DAL Cowboys @ NY Giants",
        id: "tkt_8",
        odds: "",
        stake: 0,
        status: "won",
        type: "2-Leg Spread",
      },
    ],
    total: 12,
    winRate: 58.3,
    won: 7,
  },
];

export const MOCK_PLAYERS: PlayerStat[] = [
  {
    bets: [
      {
        actualValue: "28 PTS",
        date: "Today, 7:10 PM",
        id: "b_1",
        line: "Over 26.5 Points",
        market: "Points",
        matchup: "BOS @ IND",
        odds: "",
        operator: "over",
        prop: "Points",
        status: "won",
        targetValue: 26.5,
      },
      {
        actualValue: "11 REB",
        date: "Sep 26",
        id: "b_2",
        line: "Over 8.5 Rebounds",
        market: "Rebounds",
        matchup: "BOS vs NYK",
        odds: "",
        operator: "over",
        prop: "Rebounds",
        status: "won",
        targetValue: 8.5,
      },
      {
        actualValue: "4 3PT",
        date: "Sep 23",
        id: "b_3",
        line: "Over 2.5 Made 3PT",
        market: "3-Pointers",
        matchup: "BOS @ MIA",
        odds: "",
        operator: "over",
        prop: "Threes",
        status: "won",
        targetValue: 2.5,
      },
      {
        actualValue: "3 AST",
        date: "Sep 19",
        id: "b_4",
        line: "Over 4.5 Assists",
        market: "Assists",
        matchup: "BOS vs CLE",
        odds: "",
        operator: "over",
        prop: "Assists",
        status: "lost",
        targetValue: 4.5,
      },
      {
        actualValue: "31 PTS",
        date: "Sep 16",
        id: "b_4b",
        line: "Over 27.5 Points",
        market: "Points",
        matchup: "BOS @ MIL",
        odds: "",
        operator: "over",
        prop: "Points",
        status: "won",
        targetValue: 27.5,
      },
    ],
    hitRate: 78.6,
    id: "jayson_tatum",
    lost: 6,
    name: "Jayson Tatum",
    selections: 28,
    sport: "NBA",
    team: "BOS Celtics",
    won: 22,
  },
  {
    bets: [
      {
        actualValue: "32 PTS",
        date: "Sep 27",
        id: "b_5",
        line: "Over 27.5 Points",
        market: "Points",
        matchup: "GSW vs PHX",
        odds: "",
        operator: "over",
        prop: "Points",
        status: "won",
        targetValue: 27.5,
      },
      {
        actualValue: "6 3PT",
        date: "Sep 24",
        id: "b_6",
        line: "Over 3.5 Made 3PT",
        market: "3-Pointers",
        matchup: "GSW @ LAL",
        odds: "",
        operator: "over",
        prop: "Threes",
        status: "won",
        targetValue: 3.5,
      },
      {
        actualValue: "4 AST",
        date: "Sep 20",
        id: "b_7",
        line: "Over 5.5 Assists",
        market: "Assists",
        matchup: "GSW vs DEN",
        odds: "",
        operator: "over",
        prop: "Assists",
        status: "lost",
        targetValue: 5.5,
      },
      {
        actualValue: "29 PTS",
        date: "Sep 17",
        id: "b_7b",
        line: "Over 26.5 Points",
        market: "Points",
        matchup: "GSW @ SAC",
        odds: "",
        operator: "over",
        prop: "Points",
        status: "won",
        targetValue: 26.5,
      },
    ],
    hitRate: 75.0,
    id: "steph_curry",
    lost: 6,
    name: "Steph Curry",
    selections: 24,
    sport: "NBA",
    team: "GS Warriors",
    won: 18,
  },
  {
    bets: [
      {
        actualValue: "2 TD",
        date: "Sunday, 1:00 PM",
        id: "b_8",
        line: "Over 1.5 Pass TDs",
        market: "Pass TDs",
        matchup: "KC @ BUF",
        odds: "",
        operator: "over",
        prop: "Passing",
        status: "live",
        targetValue: 1.5,
      },
      {
        actualValue: "288 YDS",
        date: "Sep 22",
        id: "b_9",
        line: "Over 265.5 Pass Yds",
        market: "Pass Yards",
        matchup: "KC vs ATL",
        odds: "",
        operator: "over",
        prop: "Passing Yds",
        status: "won",
        targetValue: 265.5,
      },
      {
        actualValue: "14 YDS",
        date: "Sep 15",
        id: "b_10",
        line: "Over 18.5 Rush Yds",
        market: "Rush Yards",
        matchup: "KC vs CIN",
        odds: "",
        operator: "over",
        prop: "Rushing",
        status: "lost",
        targetValue: 18.5,
      },
      {
        actualValue: "3 TD",
        date: "Sep 08",
        id: "b_10b",
        line: "Over 1.5 Pass TDs",
        market: "Pass TDs",
        matchup: "KC @ BAL",
        odds: "",
        operator: "over",
        prop: "Passing",
        status: "won",
        targetValue: 1.5,
      },
    ],
    hitRate: 70.0,
    id: "patrick_mahomes",
    lost: 6,
    name: "Patrick Mahomes",
    selections: 20,
    sport: "NFL",
    team: "KC Chiefs",
    won: 14,
  },
  {
    bets: [
      {
        actualValue: "8 AST",
        date: "Today, 7:10 PM",
        id: "b_11",
        line: "Over 9.5 Assists",
        market: "Assists",
        matchup: "IND vs BOS",
        odds: "",
        operator: "over",
        prop: "Assists",
        status: "live",
        targetValue: 9.5,
      },
      {
        actualValue: "22 PTS / 12 AST",
        date: "Sep 25",
        id: "b_12",
        line: "Over 8.5 Assists",
        market: "Assists",
        matchup: "IND @ CHI",
        odds: "",
        operator: "over",
        prop: "Assists",
        status: "won",
        targetValue: 8.5,
      },
      {
        actualValue: "14 PTS",
        date: "Sep 21",
        id: "b_12b",
        line: "Over 16.5 Points",
        market: "Points",
        matchup: "IND vs DET",
        odds: "",
        operator: "over",
        prop: "Points",
        status: "lost",
        targetValue: 16.5,
      },
    ],
    hitRate: 66.7,
    id: "tyrese_haliburton",
    lost: 6,
    name: "Tyrese Haliburton",
    selections: 18,
    sport: "NBA",
    team: "IND Pacers",
    won: 12,
  },
];

export const MOCK_COMMUNITY: CommunityDetail = {
  channels: [
    { id: "vip-picks", name: "vip-picks", unreadCount: 2 },
    { id: "live-sweats", name: "live-sweats", unreadCount: 5 },
    { id: "general", name: "general" },
    { id: "slips-vault", name: "slips-vault" },
  ],
  description: "Verified player prop algorithm picks, live sweats, and community bankroll discussions.",
  id: "comm_courtvision",
  isCreator: true,
  memberCount: 1248,
  messages: {
    "live-sweats": [
      {
        authorHandle: "@cgstewart",
        authorName: "Cameron Stewart",
        content: "Tatum just drained that corner 3 to clear 26.5 points! 2 legs cashed in the SGP already 🔥",
        id: "msg_1",
        lastReplyTime: "8m ago",
        reactions: [
          { count: 14, emoji: "🔥" },
          { count: 8, emoji: "🎯" },
        ],
        replies: [
          {
            authorHandle: "@stat_hunter",
            authorName: "Alex Vance",
            content: "Shot selection has been elite tonight. Zero contested mid-rangers.",
            id: "rep_1_1",
            reactions: [{ count: 4, emoji: "👍" }],
            roleBadge: "MEMBER",
            timestamp: "7:45 PM",
          },
          {
            authorHandle: "@prop_wizard",
            authorName: "Marcus Rivera",
            content: "If Haliburton gets these last 2 assists, this entire ticket sweeps!",
            id: "rep_1_2",
            reactions: [{ count: 7, emoji: "🚀" }],
            roleBadge: "VIP",
            timestamp: "7:47 PM",
          },
        ],
        repliesCount: 2,
        roleBadge: "CREATOR",
        timestamp: "7:44 PM",
      },
      {
        authorHandle: "@sharp_mike",
        authorName: "Mike Daniels",
        content: "Haliburton is at 8 assists with 4 minutes left in the 4th quarter. Need 2 more to cash the 4-leg slip!",
        id: "msg_2",
        lastReplyTime: "3m ago",
        reactions: [
          { count: 9, emoji: "👀" },
          { count: 5, emoji: "🚀" },
        ],
        replies: [
          {
            authorHandle: "@baller_jay",
            authorName: "Jaylen Brooks",
            content: "Pacers running high pick and roll every possession now. He'll get it.",
            id: "rep_2_1",
            reactions: [{ count: 3, emoji: "💯" }],
            roleBadge: "VIP",
            timestamp: "7:47 PM",
          },
        ],
        repliesCount: 1,
        roleBadge: "VIP",
        timestamp: "7:46 PM",
      },
      {
        authorHandle: "@marcus_v",
        authorName: "Marcus Vance",
        content: "DraftKings cashout offer updated. All legs currently tracking positive on this slip!",
        id: "msg_3",
        isCreator: true,
        reactions: [
          { count: 22, emoji: "🙌" },
          { count: 18, emoji: "💎" },
        ],
        roleBadge: "AGENT",
        ticketAttachment: {
          id: "tkt_live_01",
          legsCount: 4,
          odds: "",
          summary: "DraftKings 4-Leg BOS@IND SGP",
        },
        timestamp: "7:48 PM",
      },
    ],
    "vip-picks": [
      {
        authorHandle: "@marcus_v",
        authorName: "Marcus Vance",
        content: "Tonight's Official VIP Lock: 4-Leg SGP on Boston @ Indiana. All legs verified through real tracking.",
        id: "vip_1",
        isCreator: true,
        reactions: [
          { count: 42, emoji: "🔥" },
          { count: 31, emoji: "🎯" },
        ],
        roleBadge: "AGENT",
        ticketAttachment: {
          id: "tkt_live_01",
          legsCount: 4,
          odds: "",
          summary: "DraftKings 4-Leg BOS@IND SGP",
        },
        timestamp: "5:30 PM",
      },
    ],
  },
  name: "CourtVision VIP",
  onlineCount: 84,
  pinnedSlip: {
    creator: "Marcus Vance",
    id: "tkt_live_01",
    legs: [
      { line: "Over 26.5 Pts", status: "won", subject: "Jayson Tatum" },
      { line: "Over 1.5 Made 3PT", status: "won", subject: "Derrick White" },
      { line: "Over 9.5 Assists", status: "live", subject: "Tyrese Haliburton" },
      { line: "Over 6.5 Rebounds", status: "live", subject: "Myles Turner" },
    ],
    odds: "",
    stake: 0,
    title: "NBA Friday Night SGP: Celtics @ Pacers",
  },
  slug: "courtvision-vip",
};

// ---------------------------------------------------------------------------
// Server -> UI adapters
// ---------------------------------------------------------------------------

const formatClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const toMobileLeg = (
  leg: TicketsPayload["tickets"][number]["legs"][number]
): MobileLeg => ({
  currentValue: leg.currentValue ?? 0,
  id: leg.id,
  lostAt: leg.lostAt,
  marketDescription: leg.displayDescription ?? leg.rawDescription,
  operator: leg.operator,
  rawDescription: leg.rawDescription,
  status:
    leg.status === "won" || leg.status === "lost" || leg.status === "live"
      ? leg.status
      : "pending",
  subjectName: leg.subjectName,
  targetValue: leg.targetValue ?? 0,
  wonAt: leg.wonAt,
});

const toMobileTicket = (ticket: TicketsPayload["tickets"][number]): MobileTicket => {
  const status = ticket.status;
  const settledStatus =
    ticket.displayedResult === "lost"
      ? "lost"
      : ticket.displayedResult === "won"
        ? "won"
        : "won";
  return {
    cashoutOffer: undefined,
    createdAt: ticket.createdAt,
    id: ticket.id,
    legs: ticket.legs.map(toMobileLeg),
    odds: "",
    originalStake: 0,
    sourceName: ticket.sourceName ?? "Manual import",
    sportsEvent: "",
    status: (() => {
      switch (status) {
        case "draft":
        case "needs_review":
          return "needs_review" as const;
        case "scheduled":
          return "scheduled" as const;
        case "live":
          return "live" as const;
        case "won":
          return "won" as const;
        case "lost":
          return "lost" as const;
        default:
          // settled / push / void / partially_void collapse to a result badge
          return settledStatus as "won" | "lost";
      }
    })(),
    ticketType:
      ticket.ticketType === "sgp"
        ? "sgp"
        : ticket.ticketType === "single"
          ? "single"
          : "parlay",
    verificationStatus:
      ticket.verificationStatus === "verified" ? "verified" : "unverified",
  };
};

const deriveMetrics = (tickets: MobileTicket[]): MobileMetrics => {
  const active = tickets.filter(
    (ticket) => ticket.status === "live" || ticket.status === "scheduled"
  );
  const won = tickets.filter((ticket) => ticket.status === "won");
  const lost = tickets.filter((ticket) => ticket.status === "lost");
  let streak = 0;
  for (const ticket of tickets) {
    if (ticket.status === "won") {
      streak += 1;
    } else if (ticket.status === "lost") {
      break;
    }
  }
  const settled = won.length + lost.length;
  return {
    activeTicketsCount: active.length,
    activeValueAtRisk: active.reduce(
      (total, ticket) => total + ticket.originalStake,
      0
    ),
    cashedTicketsCount: won.length,
    netProfitUnits: `${won.length - lost.length >= 0 ? "+" : ""}${(won.length - lost.length).toFixed(1)}u`,
    streak,
    winRatePercent: settled > 0 ? (won.length / settled) * 100 : 0,
  };
};

const categoryFromType = (
  type: string
): MobileNotification["category"] => {
  switch (type) {
    case "ticket.won":
      return "ticket_won";
    case "ticket.lost":
      return "ticket_lost";
    case "community.mention":
      return "mention";
    default:
      return "leg_hit";
  }
};

const toMobileNotification = (
  item: NotificationsPayload["notifications"][number]
): MobileNotification => ({
  body: item.body,
  category: categoryFromType(item.type),
  createdAt: item.createdAt ? formatClock(item.createdAt) : "Just now",
  id: item.id,
  read: Boolean(item.readAt),
  ticketId: item.ticketId ?? "",
  title: item.title,
});

const EMPTY_METRICS: MobileMetrics = {
  activeTicketsCount: 0,
  activeValueAtRisk: 0,
  cashedTicketsCount: 0,
  netProfitUnits: "0.0u",
  streak: 0,
  winRatePercent: 0,
};

// ---------------------------------------------------------------------------
// Data hooks
//
// The demo account keeps the high-fidelity fixtures as the reference shape
// for the UI. Authenticated accounts get real RPC data; empty states stay
// empty so a fresh account reflects reality instead of mock content.
// ---------------------------------------------------------------------------

export function useDashboardData() {
  const { user } = useAppState();
  const isDemo = isDemoUser(user);
  return useQuery({
    queryFn: async (): Promise<{
      metrics: MobileMetrics;
      tickets: MobileTicket[];
    }> => {
      if (isDemo) {
        return { metrics: MOCK_METRICS, tickets: MOCK_TICKETS };
      }
      try {
        const res = await client.api.v1.tickets.$get({
          query: { limit: "100" },
        });
        if (res.ok) {
          const { tickets } = await res.json();
          const mapped = tickets.map(toMobileTicket);
          return { metrics: deriveMetrics(mapped), tickets: mapped };
        }
      } catch {
        // Network hiccup: show the empty state rather than fake tickets.
      }
      return { metrics: EMPTY_METRICS, tickets: [] };
    },
    queryKey: ["mobile-dashboard-data", isDemo],
    refetchInterval: isDemo ? 10000 : 30000,
  });
}

export function useNotificationsData() {
  const { user } = useAppState();
  const isDemo = isDemoUser(user);
  return useQuery({
    queryFn: async (): Promise<MobileNotification[]> => {
      if (isDemo) {
        return MOCK_NOTIFICATIONS;
      }
      try {
        const res = await client.api.v1.notifications.$get();
        if (res.ok) {
          const { notifications } = await res.json();
          return notifications.map(toMobileNotification);
        }
      } catch {
        // Fall back to an empty list for real accounts.
      }
      return [];
    },
    queryKey: ["mobile-notifications-data", isDemo],
  });
}

export async function markNotificationAsRead(
  notificationId: string
): Promise<boolean> {
  try {
    const res =
      await client.api.v1.notifications[":notificationId"].read.$patch({
        param: { notificationId },
      });
    return res.ok;
  } catch {
    return false;
  }
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
  try {
    const res = await client.api.v1.notifications["read-all"].$patch();
    return res.ok;
  } catch {
    return false;
  }
}

export const MOCK_PROFILE: MobileProfile = {
  antiFraudVerified: true,
  avatarUrl: undefined,
  handle: "cgstewart",
  lossesCount: 45,
  memberSince: "Nov 2024",
  name: "Cameron Stewart",
  roiUnits: "+24.8u",
  sportsBreakdown: [
    { percent: 58, sport: "NBA" },
    { percent: 24, sport: "NFL" },
    { percent: 18, sport: "MLB" },
  ],
  totalBetsTracked: 142,
  winRatePercent: 68.4,
  winsCount: 97,
};

// ---------------------------------------------------------------------------
// Community directory + chat
// ---------------------------------------------------------------------------

export interface CommunityDirectoryItem {
  activeChannel: string;
  avatar: string;
  creator: string;
  description: string;
  id: string;
  isJoined: boolean;
  isPaid?: boolean;
  memberCount: number;
  name: string;
  onlineCount: number;
  price?: string;
  sport: string;
  unreadCount?: number;
}

const initialsOf = (name: string): string =>
  name
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "PP";

type CommunitySummaryPayload =
  PublicCommunitiesPayload["communities"][number];

const toDirectoryItem = (
  community: CommunitySummaryPayload,
  isJoined: boolean
): CommunityDirectoryItem => ({
  activeChannel: "general",
  avatar: initialsOf(community.name),
  creator: community.ownerUsername ?? "founder",
  description: community.description ?? "",
  id: community.slug,
  isJoined,
  isPaid: community.access === "paid",
  memberCount: community.memberCount ?? 0,
  name: community.name,
  onlineCount: 0,
  price:
    community.access === "paid" && community.priceCents
      ? `$${(community.priceCents / 100).toFixed(2)} / mo`
      : undefined,
  sport: "Multi-Sport",
});

/** Joined rooms plus the public discovery feed for authenticated accounts. */
export function useCommunitiesDirectory(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async (): Promise<{
      discover: CommunityDirectoryItem[];
      joined: CommunityDirectoryItem[];
    }> => {
      const [joinedRes, publicRes] = await Promise.all([
        client.api.v1.communities.$get(),
        client.api.v1.communities.public.$get({ query: { limit: "50" } }),
      ]);
      const joined = joinedRes.ok
        ? (await joinedRes.json()).communities
        : [];
      const discover = publicRes.ok
        ? (await publicRes.json()).communities
        : [];
      const joinedSlugs = new Set(joined.map((community) => community.slug));
      return {
        joined: joined.map((community) => toDirectoryItem(community, true)),
        discover: discover
          .filter((community) => !joinedSlugs.has(community.slug))
          .map((community) => toDirectoryItem(community, false)),
      };
    },
    queryKey: ["mobile-communities-directory"],
  });
}

const toCommunityMessageItem = (
  row: ChannelMessagesPayload["messages"][number]
): { item: CommunityMessageItem; replyToId: string | null } => ({
  item: {
    authorHandle: row.author.username ? `@${row.author.username}` : "",
    authorName: row.author.name,
    content: row.body,
    id: row.id,
    reactions: row.reactions ?? [],
    replies: [],
    repliesCount: 0,
    timestamp: formatClock(row.createdAt),
  },
  replyToId: row.replyToId,
});

/** Groups flat server rows (replyToId) into Slack-style threads. */
const groupThreadMessages = (
  rows: ChannelMessagesPayload["messages"]
): CommunityMessageItem[] => {
  const mapped = rows.map(toCommunityMessageItem);
  const byId = new Map(mapped.map(({ item }) => [item.id, item]));
  const roots: CommunityMessageItem[] = [];
  for (const { item, replyToId } of mapped) {
    const parent = replyToId ? byId.get(replyToId) : null;
    if (parent && parent !== item) {
      parent.replies = [...(parent.replies ?? []), item];
      parent.repliesCount = (parent.repliesCount ?? 0) + 1;
      parent.lastReplyTime = item.timestamp;
    } else {
      roots.push(item);
    }
  }
  return roots;
};

const EMPTY_COMMUNITY: CommunityDetail = {
  channels: [],
  description: "",
  id: "",
  isCreator: false,
  memberCount: 0,
  messages: {},
  name: "",
  onlineCount: 0,
  slug: "",
};

/**
 * Chat-room data for one community. The demo account gets the fixture room;
 * authenticated accounts get live channels and threaded messages. `slug`
 * switches rooms when the user taps a joined community in the directory.
 */
export function useCommunityData(slug?: string) {
  const { user } = useAppState();
  const isDemo = isDemoUser(user);
  return useQuery({
    queryFn: async (): Promise<CommunityDetail> => {
      if (isDemo) {
        return MOCK_COMMUNITY;
      }
      if (!slug) {
        return EMPTY_COMMUNITY;
      }
      try {
        const detailRes = await client.api.v1.communities[":slug"].$get({
          param: { slug },
        });
        if (!detailRes.ok) {
          return EMPTY_COMMUNITY;
        }
        const detail = await detailRes.json();
        const channelSlices = await Promise.all(
          detail.channels.slice(0, 6).map(async (channel) => {
            const res =
              await client.api.v1.communities[":slug"].channels[
                ":channelId"
              ].messages.$get({
                param: { slug, channelId: channel.id },
                query: { limit: "50" },
              });
            const payload = res.ok ? await res.json() : null;
            return [
              channel.id,
              payload?.messages ?? [],
              payload?.nextCursor ?? null,
            ] as const;
          })
        );
        const messages: Record<string, CommunityMessageItem[]> = {};
        const cursors: Record<string, string | null> = {};
        for (const [channelId, rows, nextCursor] of channelSlices) {
          messages[channelId] = groupThreadMessages(rows);
          cursors[channelId] = nextCursor;
        }
        return {
          channels: detail.channels.map((channel) => ({
            id: channel.id,
            name: channel.name,
          })),
          cursors,
          description: detail.community.description ?? "",
          id: detail.community.id,
          isCreator: detail.membership?.role === "owner",
          memberCount: detail.community.memberCount ?? 0,
          messages,
          name: detail.community.name,
          onlineCount: 0,
          slug: detail.community.slug,
        };
      } catch {
        return EMPTY_COMMUNITY;
      }
    },
    queryKey: ["mobile-community-data", isDemo, slug ?? "none"],
    // Poll while a room is open so chats feel live without WebSocket
    // cookie support on native.
    refetchInterval: isDemo || !slug ? false : 15_000,
  });
}

/**
 * Fetch one older page of channel history (grouped into threads), used by
 * the "load earlier messages" control in the chat view.
 */
export async function fetchChannelThreadPage(input: {
  channelId: string;
  cursor: string;
  slug: string;
}): Promise<{
  messages: CommunityMessageItem[];
  nextCursor: string | null;
} | null> {
  try {
    const res =
      await client.api.v1.communities[":slug"].channels[
        ":channelId"
      ].messages.$get({
        param: { slug: input.slug, channelId: input.channelId },
        query: { cursor: input.cursor, limit: "50" },
      });
    if (!res.ok) {
      return null;
    }
    const payload = await res.json();
    return {
      messages: groupThreadMessages(payload.messages),
      nextCursor: payload.nextCursor,
    };
  } catch {
    return null;
  }
}

/** Toggle the caller's emoji reaction on a message; returns the new state. */
export async function toggleMessageReaction(input: {
  channelId: string;
  emoji: string;
  messageId: string;
  slug: string;
}): Promise<Array<{ count: number; emoji: string; mine?: boolean }> | null> {
  try {
    const res =
      await client.api.v1.communities[":slug"].channels[
        ":channelId"
      ].messages[":messageId"].reactions.$post({
        param: {
          slug: input.slug,
          channelId: input.channelId,
          messageId: input.messageId,
        },
        json: { emoji: input.emoji },
      });
    if (!res.ok) {
      return null;
    }
    const { reactions } = await res.json();
    return reactions;
  } catch {
    return null;
  }
}

export interface CommunityMemberItem {
  handle: string;
  name: string;
  role: string;
}

/** Active-member roster for the members modal. */
export async function fetchCommunityMembers(
  slug: string
): Promise<CommunityMemberItem[]> {
  try {
    const res = await client.api.v1.communities[":slug"].members.$get({
      param: { slug },
    });
    if (!res.ok) {
      return [];
    }
    const { members } = await res.json();
    return members
      .filter((member) => member.status === "active")
      .map((member) => ({
        handle: member.user.username ? `@${member.user.username}` : "member",
        name: member.user.name,
        role:
          member.role === "owner"
            ? "Creator · Admin"
            : member.role === "moderator"
              ? "Moderator"
              : "Member",
      }));
  } catch {
    return [];
  }
}

/** Send a chat message (or thread reply) over the REST route. */
export async function sendCommunityMessage(input: {
  body: string;
  channelId: string;
  clientId?: string;
  replyToId?: string | null;
  slug: string;
}): Promise<CommunityMessageItem | null> {
  try {
    const res =
      await client.api.v1.communities[":slug"].channels[
        ":channelId"
      ].messages.$post({
        param: { slug: input.slug, channelId: input.channelId },
        json: {
          body: input.body,
          clientId: input.clientId ?? `local_${Date.now()}`,
          replyToId: input.replyToId ?? null,
          type: "message",
        },
      });
    if (!res.ok) {
      return null;
    }
    const { message } = await res.json();
    return toCommunityMessageItem(message).item;
  } catch {
    return null;
  }
}

/** Join a community; paid rooms return a Stripe checkout URL to open. */
export async function joinCommunity(
  slug: string
): Promise<{ checkoutUrl: string | null; error: string | null; joined: boolean }> {
  try {
    const res = await client.api.v1.communities[":slug"].join.$post({
      param: { slug },
    });
    const data = await res.json();
    if (!res.ok || "error" in data) {
      return {
        checkoutUrl: null,
        error: "error" in data ? data.error : "Unable to join community",
        joined: false,
      };
    }
    const checkoutUrl = "checkoutUrl" in data ? data.checkoutUrl : null;
    const joined =
      "membership" in data && data.membership.status === "active";
    return { checkoutUrl, error: null, joined };
  } catch {
    return { checkoutUrl: null, error: "Network error", joined: false };
  }
}

/** Create a community (Creator plan required) with a default channel. */
export async function createCommunity(input: {
  access: "free" | "paid";
  description?: string | null;
  name: string;
  priceCents?: number | null;
  slug: string;
  visibility?: "public" | "private";
}): Promise<{ community?: CommunityDirectoryItem; error: string | null }> {
  try {
    const res = await client.api.v1.communities.$post({ json: input });
    const data = await res.json();
    if (!res.ok || "error" in data) {
      return {
        error:
          "error" in data ? data.error : "Unable to create the community",
      };
    }
    return {
      community: toDirectoryItem(
        { ...data.community, memberCount: data.community.memberCount ?? 1 },
        true
      ),
      error: null,
    };
  } catch {
    return { error: "Network error" };
  }
}

/** Add a channel to a community the user moderates. */
export async function createCommunityChannel(
  slug: string,
  input: { description?: string | null; name: string; slug: string }
): Promise<boolean> {
  try {
    const res =
      await client.api.v1.communities[":slug"].channels.$post({
        param: { slug },
        json: input,
      });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Profile + analytics
// ---------------------------------------------------------------------------

export function useProfileData() {
  const { user } = useAppState();
  const isDemo = isDemoUser(user);
  return useQuery({
    queryFn: async (): Promise<MobileProfile> => {
      if (isDemo) {
        return MOCK_PROFILE;
      }
      let profile: MobileProfile = {
        antiFraudVerified: false,
        avatarUrl: undefined,
        handle: "you",
        lossesCount: 0,
        memberSince: "Today",
        name: user?.name ?? "Bettor",
        roiUnits: "0.0u",
        sportsBreakdown: [],
        totalBetsTracked: 0,
        winRatePercent: 0,
        winsCount: 0,
      };
      try {
        const meRes = await client.api.v1.me.$get();
        if (meRes.ok) {
          const { user: me } = await meRes.json();
          profile = {
            ...profile,
            avatarUrl: me.image ?? undefined,
            handle: me.profile?.username ?? "you",
            name: me.name,
          };
        }
        const ticketsRes = await client.api.v1.tickets.$get({
          query: { limit: "100" },
        });
        if (ticketsRes.ok) {
          const tickets = (await ticketsRes.json()).tickets.map(
            toMobileTicket
          );
          const metrics = deriveMetrics(tickets);
          const oldest = tickets.at(-1);
          profile = {
            ...profile,
            antiFraudVerified: tickets.some(
              (ticket) => ticket.verificationStatus === "verified"
            ),
            lossesCount: tickets.filter(
              (ticket) => ticket.status === "lost"
            ).length,
            memberSince: oldest
              ? new Date(oldest.createdAt).toLocaleDateString([], {
                  month: "short",
                  year: "numeric",
                })
              : "Today",
            roiUnits: metrics.netProfitUnits,
            totalBetsTracked: tickets.length,
            winRatePercent: metrics.winRatePercent,
            winsCount: tickets.filter((ticket) => ticket.status === "won")
              .length,
          };
        }
      } catch {
        // Keep defaults when the profile cannot be loaded.
      }
      return profile;
    },
    queryKey: ["mobile-profile-data", isDemo],
  });
}

export interface AnalyticsData {
  formStrip: Array<"won" | "lost">;
  metrics: {
    avgLegsPerSlip: string;
    totalSlips: number;
    verifiedSlips: number;
    winRate: number;
  };
  players: PlayerStat[];
  sportsbooks: SportsbookStat[];
}

const EMPTY_ANALYTICS: AnalyticsData = {
  formStrip: [],
  metrics: { avgLegsPerSlip: "0.0", totalSlips: 0, verifiedSlips: 0, winRate: 0 },
  players: [],
  sportsbooks: [],
};

const deriveAnalytics = (tickets: MobileTicket[]): AnalyticsData => {
  const bySubject = new Map<string, PlayerStat>();
  for (const ticket of tickets) {
    for (const leg of ticket.legs) {
      const entry =
        bySubject.get(leg.subjectName) ??
        ({
          bets: [],
          hitRate: 0,
          id: leg.id,
          lost: 0,
          name: leg.subjectName,
          selections: 0,
          sport: "",
          team: "",
          won: 0,
        } satisfies PlayerStat);
      entry.selections += 1;
      if (leg.status === "won") {
        entry.won += 1;
      }
      if (leg.status === "lost") {
        entry.lost += 1;
      }
      entry.bets.push({
        actualValue: leg.currentValue ? String(leg.currentValue) : "—",
        date: formatClock(ticket.createdAt),
        id: leg.id,
        line: leg.rawDescription,
        market: leg.marketDescription,
        matchup: ticket.sportsEvent || "—",
        odds: ticket.odds,
        operator: leg.operator === "under" ? "under" : "over",
        prop: leg.marketDescription,
        status:
          leg.status === "won" || leg.status === "lost"
            ? leg.status
            : "live",
        targetValue: leg.targetValue,
      });
      bySubject.set(leg.subjectName, entry);
    }
  }
  const players = [...bySubject.values()].map((player) => ({
    ...player,
    hitRate:
      player.selections > 0 ? (player.won / player.selections) * 100 : 0,
  }));

  const bySource = new Map<string, SportsbookStat>();
  for (const ticket of tickets) {
    const name = ticket.sourceName || "Manual";
    const entry =
      bySource.get(name) ??
      ({
        id: name,
        lost: 0,
        name,
        tickets: [],
        total: 0,
        winRate: 0,
        won: 0,
      } satisfies SportsbookStat);
    entry.total += 1;
    if (ticket.status === "won") {
      entry.won += 1;
    }
    if (ticket.status === "lost") {
      entry.lost += 1;
    }
    entry.tickets.push({
      date: formatClock(ticket.createdAt),
      event: ticket.sportsEvent || "—",
      id: ticket.id,
      odds: ticket.odds,
      stake: ticket.originalStake,
      status:
        ticket.status === "won" || ticket.status === "lost"
          ? ticket.status
          : "live",
      type: `${ticket.legs.length}-Leg ${ticket.ticketType.toUpperCase()}`,
    });
    bySource.set(name, entry);
  }
  const sportsbooks = [...bySource.values()].map((book) => ({
    ...book,
    winRate: book.total > 0 ? (book.won / book.total) * 100 : 0,
  }));

  const settled = tickets.filter(
    (ticket) => ticket.status === "won" || ticket.status === "lost"
  );
  const verified = tickets.filter(
    (ticket) => ticket.verificationStatus === "verified"
  );
  const legCount = tickets.reduce(
    (total, ticket) => total + ticket.legs.length,
    0
  );
  return {
    formStrip: settled
      .slice(0, 10)
      .toReversed()
      .map((ticket) => (ticket.status === "won" ? "won" : "lost")),
    metrics: {
      avgLegsPerSlip: (tickets.length > 0 ? legCount / tickets.length : 0)
        .toFixed(1),
      totalSlips: tickets.length,
      verifiedSlips: verified.length,
      winRate: deriveMetrics(tickets).winRatePercent,
    },
    players,
    sportsbooks,
  };
};

export function useAnalyticsData() {
  const { user } = useAppState();
  const isDemo = isDemoUser(user);
  return useQuery({
    queryFn: async (): Promise<AnalyticsData> => {
      if (isDemo) {
        return {
          formStrip: [
            "won",
            "won",
            "lost",
            "won",
            "won",
            "won",
            "lost",
            "won",
            "won",
            "won",
          ] as Array<"won" | "lost">,
          metrics: {
            avgLegsPerSlip: "3.4",
            totalSlips: 142,
            verifiedSlips: 138,
            winRate: 68.4,
          },
          players: MOCK_PLAYERS,
          sportsbooks: MOCK_SPORTSBOOKS,
        };
      }
      try {
        const res = await client.api.v1.tickets.$get({
          query: { limit: "100" },
        });
        if (!res.ok) {
          return EMPTY_ANALYTICS;
        }
        const tickets = (await res.json()).tickets.map(toMobileTicket);
        return deriveAnalytics(tickets);
      } catch {
        return EMPTY_ANALYTICS;
      }
    },
    queryKey: ["mobile-analytics-data", isDemo],
  });
}
