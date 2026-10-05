import type { Auth } from "@ppal/auth";
import { env } from "@ppal/env/server";

/* oxlint-disable no-await-in-loop -- Each seed step checks the previous write; the seeder is intentionally sequential and idempotent. */

/**
 * Demo data seeder.
 *
 * Loads the same fixture content the mobile app ships for its demo account
 * (bettor@parlaypal.com / Marcus Vance) into the real database, so the demo
 * experience is backed by the actual API — including on web, which has no
 * client-side fixture path. Every insert uses fixed ids and
 * `ON CONFLICT DO NOTHING`, so the endpoint is safe to call repeatedly and
 * to resume after a partial failure.
 *
 * All seeded users share the password `parlaypal-demo`.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const DEMO_PASSWORD = "parlaypal-demo";

interface SeedUser {
  bio: string;
  email: string;
  handle: string;
  name: string;
}

const DEMO_USER: SeedUser = {
  bio: "NBA player prop specialist. Heavy focus on rebounds and assists. Syndicate founder.",
  email: "bettor@parlaypal.com",
  handle: "courtvision_picks",
  name: "Marcus Vance",
};

const BETTOR_USERS: SeedUser[] = [
  {
    bio: "NBA Player Prop analyst. Heavy focus on 1Q spreads, rebound pace, and 4Q sweat threads. Transparent tracked history.",
    email: "marcus.rivera@demo.myparlaypal.com",
    handle: "marcus_prop",
    name: "Marcus Rivera",
  },
  {
    bio: "WNBA & MLB sabermetrics analyst. Strikeout regressions and batter total bases angles.",
    email: "sarah.chen@demo.myparlaypal.com",
    handle: "statline_sarah",
    name: "Sarah Chen",
  },
  {
    bio: "NFL redzone specialist. Anytime TD regression models, receiving yard lines, and Sunday sweat rooms.",
    email: "gridiron.guru@demo.myparlaypal.com",
    handle: "gridironguru",
    name: "Gridiron Guru",
  },
  {
    bio: "NBA player prop specialist. Rebounds and assists angles. Verified slips only.",
    email: "cameron.stewart@demo.myparlaypal.com",
    handle: "cgstewart",
    name: "Cameron Stewart",
  },
];

interface SeedLeg {
  currentValue: number | null;
  display: string;
  id: string;
  market: string;
  operator: string;
  raw: string;
  status: "live" | "lost" | "pending" | "won";
  subject: string;
  subjectType: "game" | "player" | "team";
  target: number | null;
}

interface SeedTicket {
  createdAtOffset: number;
  displayedResult?: "lost" | "won";
  id: string;
  legs: SeedLeg[];
  source: string;
  status: "live" | "lost" | "needs_review" | "scheduled" | "won";
  type: "parlay" | "sgp" | "single";
}

const settledLeg = (
  id: string,
  subject: string,
  market: string,
  raw: string,
  target: number | null,
  status: "lost" | "won",
  currentValue: number | null
): SeedLeg => ({
  currentValue,
  display: market,
  id,
  market,
  operator: "over",
  raw,
  status,
  subject,
  subjectType: "player",
  target,
});

const liveLeg = (
  id: string,
  subject: string,
  market: string,
  raw: string,
  target: number,
  currentValue: number
): SeedLeg => ({
  currentValue,
  display: market,
  id,
  market,
  operator: "over",
  raw,
  status: "live",
  subject,
  subjectType: "player",
  target,
});

const pendingLeg = (
  id: string,
  subject: string,
  subjectType: "game" | "player" | "team",
  market: string,
  raw: string,
  target: number | null,
  operator = "over"
): SeedLeg => ({
  currentValue: null,
  display: market,
  id,
  market,
  operator,
  raw,
  status: "pending",
  subject,
  subjectType,
  target,
});

const SEED_TICKETS: SeedTicket[] = [
  {
    createdAtOffset: 2 * HOUR,
    id: "demo-ticket-live-sgp-1",
    legs: [
      settledLeg(
        "demo-leg-1-1",
        "Jayson Tatum",
        "Points",
        "Over 26.5 Points",
        26.5,
        "won",
        28
      ),
      settledLeg(
        "demo-leg-1-2",
        "Derrick White",
        "Made 3-Point Field Goals",
        "Over 1.5 Made 3PT",
        1.5,
        "won",
        3
      ),
      liveLeg(
        "demo-leg-1-3",
        "Tyrese Haliburton",
        "Assists",
        "Over 9.5 Assists",
        9.5,
        8
      ),
      liveLeg(
        "demo-leg-1-4",
        "Myles Turner",
        "Rebounds",
        "Over 6.5 Rebounds",
        6.5,
        4
      ),
    ],
    source: "DraftKings",
    status: "live",
    type: "sgp",
  },
  {
    createdAtOffset: 2 * HOUR,
    id: "demo-ticket-scheduled-parlay-1",
    legs: [
      pendingLeg(
        "demo-leg-2-1",
        "Patrick Mahomes",
        "player",
        "Pass TDs",
        "Over 1.5 Pass TDs",
        1.5
      ),
      pendingLeg(
        "demo-leg-2-2",
        "Travis Kelce",
        "player",
        "Receiving Yards",
        "Over 68.5 Rec Yds",
        68.5
      ),
      pendingLeg(
        "demo-leg-2-3",
        "KC Chiefs",
        "team",
        "Moneyline",
        "KC Chiefs ML",
        null,
        "moneyline"
      ),
    ],
    source: "FanDuel",
    status: "scheduled",
    type: "parlay",
  },
  {
    createdAtOffset: 30 * 60_000,
    id: "demo-ticket-live-parlay-1",
    legs: [
      settledLeg(
        "demo-leg-3-1",
        "Giannis Antetokounmpo",
        "Points",
        "Over 30.5 Points",
        30.5,
        "won",
        32
      ),
      liveLeg(
        "demo-leg-3-2",
        "Tyrese Maxey",
        "Points",
        "Over 24.5 Points",
        24.5,
        22
      ),
      settledLeg(
        "demo-leg-3-3",
        "Damian Lillard",
        "Assists",
        "Over 7.5 Assists",
        7.5,
        "won",
        8
      ),
    ],
    source: "BetMGM",
    status: "live",
    type: "parlay",
  },
  {
    createdAtOffset: 2 * DAY,
    id: "demo-ticket-scheduled-sgp-1",
    legs: [
      pendingLeg(
        "demo-leg-4-1",
        "Luka Doncic",
        "player",
        "Points",
        "Over 31.5 Points",
        31.5
      ),
      pendingLeg(
        "demo-leg-4-2",
        "LeBron James",
        "player",
        "Assists",
        "Over 7.5 Assists",
        7.5
      ),
    ],
    source: "DraftKings",
    status: "scheduled",
    type: "sgp",
  },
  {
    createdAtOffset: 1 * DAY,
    displayedResult: "won",
    id: "demo-ticket-settled-1",
    legs: [
      settledLeg(
        "demo-leg-5-1",
        "Jayson Tatum",
        "Points",
        "Over 26.5 Points",
        26.5,
        "won",
        29
      ),
      settledLeg(
        "demo-leg-5-2",
        "Jaylen Brown",
        "Made 3PT",
        "Over 2.5 Made 3PT",
        2.5,
        "won",
        4
      ),
    ],
    source: "DraftKings",
    status: "won",
    type: "sgp",
  },
  {
    createdAtOffset: 2 * DAY,
    displayedResult: "won",
    id: "demo-ticket-settled-2",
    legs: [
      settledLeg(
        "demo-leg-6-1",
        "Steph Curry",
        "Points",
        "Over 27.5 Points",
        27.5,
        "won",
        31
      ),
      settledLeg(
        "demo-leg-6-2",
        "Chris Paul",
        "Assists",
        "Over 6.5 Assists",
        6.5,
        "won",
        8
      ),
    ],
    source: "FanDuel",
    status: "won",
    type: "sgp",
  },
  {
    createdAtOffset: 3 * DAY,
    displayedResult: "lost",
    id: "demo-ticket-settled-3",
    legs: [
      settledLeg(
        "demo-leg-7-1",
        "Devin Booker",
        "Points",
        "Over 25.5 Points",
        25.5,
        "lost",
        22
      ),
      settledLeg(
        "demo-leg-7-2",
        "Jusuf Nurkic",
        "Rebounds",
        "Over 10.5 Rebounds",
        10.5,
        "won",
        12
      ),
    ],
    source: "BetMGM",
    status: "lost",
    type: "sgp",
  },
  {
    createdAtOffset: 4 * DAY,
    displayedResult: "won",
    id: "demo-ticket-settled-4",
    legs: [
      settledLeg(
        "demo-leg-8-1",
        "Patrick Mahomes",
        "Pass TDs",
        "Over 1.5 Pass TDs",
        1.5,
        "won",
        3
      ),
      settledLeg(
        "demo-leg-8-2",
        "Travis Kelce",
        "Receiving Yards",
        "Over 64.5 Rec Yds",
        64.5,
        "won",
        84
      ),
    ],
    source: "FanDuel",
    status: "won",
    type: "parlay",
  },
  {
    createdAtOffset: 5 * DAY,
    displayedResult: "won",
    id: "demo-ticket-settled-5",
    legs: [
      settledLeg(
        "demo-leg-9-1",
        "Tyrese Haliburton",
        "Assists",
        "Over 9.5 Assists",
        9.5,
        "won",
        11
      ),
      settledLeg(
        "demo-leg-9-2",
        "Pascal Siakam",
        "Points",
        "Over 19.5 Points",
        19.5,
        "won",
        24
      ),
    ],
    source: "DraftKings",
    status: "won",
    type: "sgp",
  },
  {
    createdAtOffset: 6 * DAY,
    displayedResult: "won",
    id: "demo-ticket-settled-6",
    legs: [
      settledLeg(
        "demo-leg-10-1",
        "Giannis Antetokounmpo",
        "Points",
        "Over 30.5 Points",
        30.5,
        "won",
        34
      ),
      settledLeg(
        "demo-leg-10-2",
        "Giannis Antetokounmpo",
        "Rebounds",
        "Over 11.5 Rebounds",
        11.5,
        "won",
        13
      ),
    ],
    source: "Caesars",
    status: "won",
    type: "sgp",
  },
  {
    createdAtOffset: 7 * DAY,
    displayedResult: "lost",
    id: "demo-ticket-settled-7",
    legs: [
      settledLeg(
        "demo-leg-11-1",
        "Anthony Edwards",
        "Points",
        "Over 22.5 Points",
        22.5,
        "lost",
        18
      ),
      settledLeg(
        "demo-leg-11-2",
        "Rudy Gobert",
        "Rebounds",
        "Over 12.5 Rebounds",
        12.5,
        "lost",
        11
      ),
    ],
    source: "FanDuel",
    status: "lost",
    type: "sgp",
  },
  {
    createdAtOffset: 8 * DAY,
    displayedResult: "won",
    id: "demo-ticket-settled-8",
    legs: [
      settledLeg(
        "demo-leg-12-1",
        "Shai Gilgeous-Alexander",
        "Points",
        "Over 28.5 Points",
        28.5,
        "won",
        32
      ),
      settledLeg(
        "demo-leg-12-2",
        "Jalen Williams",
        "Assists",
        "Over 6.5 Assists",
        6.5,
        "won",
        8
      ),
    ],
    source: "DraftKings",
    status: "won",
    type: "parlay",
  },
];

interface SeedNotification {
  body: string;
  id: string;
  offset: number;
  read: boolean;
  ticketId: string | null;
  title: string;
  type: string;
}

const SEED_NOTIFICATIONS: SeedNotification[] = [
  {
    body: "Cleared 26.5 points with a corner 3-pointer in 3Q. Leg settled as WON.",
    id: "demo-notification-1",
    offset: 2 * 60_000,
    read: false,
    ticketId: "demo-ticket-live-sgp-1",
    title: "Leg Hit: Jayson Tatum Over 26.5 Pts",
    type: "ticket.progress",
  },
  {
    body: "DraftKings SGP cashout offer available. All legs currently tracking positive.",
    id: "demo-notification-2",
    offset: 12 * 60_000,
    read: false,
    ticketId: "demo-ticket-live-sgp-1",
    title: "Cashout Alert: Early Cashout Available",
    type: "ticket.progress",
  },
  {
    body: "Derrick White made his 3rd three-pointer. Leg settled as WON.",
    id: "demo-notification-3",
    offset: 28 * 60_000,
    read: true,
    ticketId: "demo-ticket-live-sgp-1",
    title: "Leg Hit: Derrick White 2+ Threes",
    type: "ticket.progress",
  },
  {
    body: "Boston Celtics @ Indiana Pacers has tipped off at Gainbridge Fieldhouse.",
    id: "demo-notification-4",
    offset: 1 * HOUR,
    read: true,
    ticketId: "demo-ticket-live-sgp-1",
    title: "Game Live: BOS @ IND",
    type: "ticket.progress",
  },
  {
    body: "Your 2-Leg SGP from yesterday settled as WON. Both legs verified.",
    id: "demo-notification-5",
    offset: 1 * DAY,
    read: true,
    ticketId: "demo-ticket-settled-1",
    title: "Ticket Cashed: 2/2 Legs Won",
    type: "ticket.won",
  },
];

interface SeedMessage {
  authorHandle: string;
  body: string;
  id: string;
  offset: number;
  replies?: SeedMessage[];
}

interface SeedCommunity {
  access: "free" | "paid";
  description: string;
  id: string;
  members: { handle: string; role: "member" | "moderator" | "owner" }[];
  messages?: SeedMessage[];
  name: string;
  priceCents?: number;
  rules?: string;
  slug: string;
}

const COURTVISION_CHANNELS = [
  {
    description: "General syndicate chat",
    id: "demo-channel-general",
    name: "General",
    position: 0,
    slug: "general",
  },
  {
    description: "Live sweat threads for in-progress slips",
    id: "demo-channel-live-sweats",
    name: "Live Sweats",
    position: 1,
    slug: "live-sweats",
  },
  {
    description: "Official verified picks from the creator",
    id: "demo-channel-vip-picks",
    name: "VIP Picks",
    position: 2,
    slug: "vip-picks",
  },
  {
    description: "Archive of settled slips",
    id: "demo-channel-slips-vault",
    name: "Slips Vault",
    position: 3,
    slug: "slips-vault",
  },
];

const SEED_COMMUNITIES: SeedCommunity[] = [
  {
    access: "free",
    description:
      "Verified player prop algorithm picks, live sweats, and community bankroll discussions.",
    id: "demo-community-courtvision",
    members: [
      { handle: "courtvision_picks", role: "owner" },
      { handle: "cgstewart", role: "moderator" },
      { handle: "marcus_prop", role: "member" },
      { handle: "statline_sarah", role: "member" },
      { handle: "gridironguru", role: "member" },
    ],
    messages: [
      {
        authorHandle: "courtvision_picks",
        body: "Tatum just drained that corner 3 to clear 26.5 points! 2 legs cashed in the SGP already 🔥",
        id: "5eed00aa-0000-4000-8000-000000000001",
        offset: 20 * 60_000,
        replies: [
          {
            authorHandle: "marcus_prop",
            body: "Shot selection has been elite tonight. Zero contested mid-rangers.",
            id: "5eed00aa-0000-4000-8000-000000000002",
            offset: 16 * 60_000,
          },
          {
            authorHandle: "cgstewart",
            body: "If Haliburton gets these last 2 assists, this entire ticket sweeps!",
            id: "5eed00aa-0000-4000-8000-000000000003",
            offset: 13 * 60_000,
          },
        ],
      },
      {
        authorHandle: "cgstewart",
        body: "Haliburton is at 8 assists with 4 minutes left in the 4th quarter. Need 2 more to cash the 4-leg slip!",
        id: "5eed00bb-0000-4000-8000-000000000001",
        offset: 17 * 60_000,
        replies: [
          {
            authorHandle: "gridironguru",
            body: "Pacers running high pick and roll every possession now. He'll get it.",
            id: "5eed00bb-0000-4000-8000-000000000002",
            offset: 12 * 60_000,
          },
        ],
      },
      {
        authorHandle: "courtvision_picks",
        body: "DraftKings cashout offer updated. All legs currently tracking positive on this slip!",
        id: "5eed00cc-0000-4000-8000-000000000001",
        offset: 10 * 60_000,
      },
    ],
    name: "CourtVision VIP",
    rules:
      "1. 100% slip verification. 2. Analytical discussions only. 3. Respect the community. 4. No solicitation or external links.",
    slug: "courtvision-vip",
  },
  {
    access: "free",
    description:
      "Data-backed NBA player props, rebounds analysis, and fourth-quarter live sweat threads.",
    id: "demo-community-sharp-edge",
    members: [
      { handle: "cgstewart", role: "owner" },
      { handle: "courtvision_picks", role: "member" },
      { handle: "marcus_prop", role: "member" },
    ],
    name: "The Sharp Edge",
    slug: "sharp-edge",
  },
  {
    access: "free",
    description:
      "Mathematical totals and pace regressions for NBA and college basketball.",
    id: "demo-community-over-under",
    members: [
      { handle: "statline_sarah", role: "owner" },
      { handle: "courtvision_picks", role: "member" },
    ],
    name: "Over/Under Labs",
    slug: "over-under-labs",
  },
  {
    access: "paid",
    description:
      "High-probability touchdown scorers, receiving yards, and NFL Sunday sweat rooms.",
    id: "demo-community-touchdown",
    members: [{ handle: "gridironguru", role: "owner" }],
    name: "Touchdown Sweats",
    priceCents: 1999,
    slug: "touchdown-sweats",
  },
  {
    access: "free",
    description:
      "Algorithmic model projections running Monte Carlo simulations across all major leagues.",
    id: "demo-community-quant-models",
    members: [{ handle: "marcus_prop", role: "owner" }],
    name: "Quant Prop Models",
    slug: "quant-models",
  },
  {
    access: "free",
    description:
      "NHL shot-on-goal edges, powerplay props, and goalie saves regression analysis.",
    id: "demo-community-ice-puck",
    members: [{ handle: "cgstewart", role: "owner" }],
    name: "Ice Puck Sharps",
    slug: "ice-puck-sharps",
  },
  {
    access: "paid",
    description:
      "Starting pitcher strikeout totals, barrel rates, and ballpark weather adjustments.",
    id: "demo-community-diamond-props",
    members: [{ handle: "statline_sarah", role: "owner" }],
    name: "Diamond Props & Ks",
    priceCents: 2499,
    slug: "diamond-props",
  },
  {
    access: "free",
    description:
      "Premier League and UCL corner counts, card totals, and shot-on-target systems.",
    id: "demo-community-corner-goals",
    members: [{ handle: "gridironguru", role: "owner" }],
    name: "Corner & Goals Syndicate",
    slug: "corner-syndicate",
  },
  {
    access: "paid",
    description:
      "High-volume verified unit slips, line shopping across all books, and late steam alerts.",
    id: "demo-community-high-rollers",
    members: [{ handle: "marcus_prop", role: "owner" }],
    name: "High Roller Props",
    priceCents: 4999,
    slug: "high-rollers-club",
  },
];

const VIP_PICKS_MESSAGES: SeedMessage[] = [
  {
    authorHandle: "courtvision_picks",
    body: "Tonight's Official VIP Lock: 4-Leg SGP on Boston @ Indiana. All legs verified through real tracking.",
    id: "5eed01aa-0000-4000-8000-000000000001",
    offset: 3 * HOUR,
  },
];

const GENERAL_MESSAGES: SeedMessage[] = [
  {
    authorHandle: "cgstewart",
    body: "Welcome to CourtVision VIP! Share verified slips and discuss sharp props with fellow syndicates.",
    id: "5eed02aa-0000-4000-8000-000000000001",
    offset: 5 * HOUR,
  },
];

interface SeedSummary {
  channels: number;
  communities: number;
  follows: number;
  members: number;
  messages: number;
  notifications: number;
  ticketLegs: number;
  tickets: number;
  timelineEvents: number;
  users: string[];
}

interface UserDirectory {
  createdEmails: string[];
  idByHandle: Map<string, string>;
}

const ensureUsers = async (auth: Auth): Promise<UserDirectory> => {
  const idByHandle = new Map<string, string>();
  const createdEmails: string[] = [];
  // Created through better-auth so password hashing and the credential
  // account rows match exactly what sign-in expects.
  for (const seedUser of [DEMO_USER, ...BETTOR_USERS]) {
    const existing = await env.DB.prepare("SELECT id FROM user WHERE email = ?")
      .bind(seedUser.email)
      .first<{ id: string }>();
    if (existing) {
      idByHandle.set(seedUser.handle, existing.id);
      continue;
    }
    const result = await auth.api.signUpEmail({
      body: {
        email: seedUser.email,
        name: seedUser.name,
        password: DEMO_PASSWORD,
      },
    });
    const id = result?.user?.id;
    if (!id) {
      throw new Error(`Could not create demo user ${seedUser.email}`);
    }
    await env.DB.prepare("UPDATE user SET email_verified = 1 WHERE id = ?")
      .bind(id)
      .run();
    idByHandle.set(seedUser.handle, id);
    createdEmails.push(seedUser.email);
  }
  return { createdEmails, idByHandle };
};

const idOf = (directory: UserDirectory, handle: string): string => {
  const id = directory.idByHandle.get(handle);
  if (!id) {
    throw new Error(`Unknown seeded handle: ${handle}`);
  }
  return id;
};

const ensureProfilesAndFollows = async (
  directory: UserDirectory,
  now: number
): Promise<number> => {
  // A handle may already belong to a different local account; fall back to
  // a `_demo` variant instead of failing the whole seed.
  for (const seedUser of [DEMO_USER, ...BETTOR_USERS]) {
    const uid = idOf(directory, seedUser.handle);
    const existing = await env.DB.prepare(
      "SELECT user_id, username FROM profiles WHERE user_id = ? OR username = ?"
    )
      .bind(uid, seedUser.handle)
      .first<{ user_id: string; username: string }>();
    if (existing?.user_id === uid) {
      continue;
    }
    let { handle } = seedUser;
    if (existing?.username === handle) {
      handle = `${seedUser.handle}_demo`;
      const fallbackTaken = await env.DB.prepare(
        "SELECT user_id FROM profiles WHERE username = ?"
      )
        .bind(handle)
        .first<{ user_id: string }>();
      if (fallbackTaken) {
        handle = `${seedUser.handle}_${uid.slice(0, 8)}`;
      }
    }
    await env.DB.prepare(
      `INSERT INTO profiles (bio, is_public, updated_at, user_id, username)
       VALUES (?, 1, ?, ?, ?) ON CONFLICT (user_id) DO NOTHING`
    )
      .bind(seedUser.bio, now, uid, handle)
      .run();
  }

  const followPairs: [string, string][] = [
    ["courtvision_picks", "statline_sarah"],
    ["courtvision_picks", "marcus_prop"],
    ["statline_sarah", "courtvision_picks"],
    ["cgstewart", "courtvision_picks"],
    ["marcus_prop", "statline_sarah"],
    ["gridironguru", "courtvision_picks"],
  ];
  await env.DB.batch(
    followPairs.map(([follower, followed], index) =>
      env.DB.prepare(
        `INSERT INTO follows (created_at, followed_user_id, follower_user_id, id)
         VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`
      ).bind(
        now - index * HOUR,
        idOf(directory, followed),
        idOf(directory, follower),
        `demo-follow-${index}`
      )
    )
  );
  return followPairs.length;
};

const ensureEntitlementAndPreferences = async (
  demoUserId: string,
  now: number
): Promise<void> => {
  // Pro entitlement so analytics mirrors the demo fixtures.
  await env.DB.prepare(
    `INSERT INTO billing_entitlements
       (created_at, current_period_start, effective_at, id, plan,
        provider_reference, source, status, updated_at, user_id)
     VALUES (?, ?, ?, 'demo-entitlement-1', 'pro', ?, 'manual', 'active', ?, ?)
     ON CONFLICT (id) DO NOTHING`
  )
    .bind(now, now, now, `demo-seed:${demoUserId}`, now, demoUserId)
    .run();

  await env.DB.prepare(
    `INSERT INTO notification_preferences
       (email_enabled, in_app_enabled, leg_lost, leg_won, push_enabled,
        sms_enabled, ticket_lost, ticket_won, updated_at, user_id)
     VALUES (1, 1, 1, 1, 1, 0, 1, 1, ?, ?)
     ON CONFLICT (user_id) DO NOTHING`
  )
    .bind(now, demoUserId)
    .run();
};

const ensureTickets = async (
  demoUserId: string,
  now: number
): Promise<{
  legCount: number;
  ticketCount: number;
  timelineCount: number;
}> => {
  // Retire settled timeline rows an earlier seed run wrote for live and
  // scheduled tickets (only genuinely settled tickets carry them now).
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM ticket_timeline_events WHERE transition_key LIKE 'demo-ticket-live-%:seed:settled'"
    ),
    env.DB.prepare(
      "DELETE FROM ticket_timeline_events WHERE transition_key LIKE 'demo-ticket-scheduled-%:seed:settled'"
    ),
  ]);
  const ticketStatements = [];
  const legStatements = [];
  const timelineStatements = [];
  for (const ticket of SEED_TICKETS) {
    const createdAt = now - ticket.createdAtOffset;
    const settled = ticket.status === "won" || ticket.status === "lost";
    ticketStatements.push(
      env.DB.prepare(
        `INSERT INTO tickets
           (confirmed_at, created_at, displayed_result, id, ingestion_mode,
            notification_interval_minutes, result_source, settled_at, source_name,
            status, ticket_type, tracking_started_at, updated_at, user_id,
            verification_status, verified_at, version)
         VALUES (?, ?, ?, ?, 'live', 5, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, 1)
         ON CONFLICT (id) DO NOTHING`
      ).bind(
        createdAt + 60_000,
        createdAt,
        ticket.displayedResult ?? null,
        ticket.id,
        settled ? "settled_slip" : "live_provider",
        settled ? createdAt + 3 * HOUR : null,
        ticket.source,
        ticket.status,
        ticket.type,
        createdAt + 60_000,
        now,
        demoUserId,
        settled ? createdAt + 3 * HOUR : null
      )
    );
    for (const leg of ticket.legs) {
      const legSettled = leg.status === "won" || leg.status === "lost";
      legStatements.push(
        env.DB.prepare(
          `INSERT INTO ticket_legs
             (created_at, current_value, display_description, id, operator,
              raw_description, resolver_status, settled_at, status,
              subject_name, subject_type, target_value, ticket_id, updated_at,
              version, won_at, lost_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT (id) DO NOTHING`
        ).bind(
          createdAt,
          leg.currentValue,
          leg.display,
          leg.id,
          leg.operator,
          leg.raw,
          settled ? "resolved" : "ambiguous",
          legSettled ? createdAt + 2 * HOUR : null,
          leg.status,
          leg.subject,
          leg.subjectType,
          leg.target,
          ticket.id,
          now,
          leg.status === "won" ? createdAt + 2 * HOUR : null,
          leg.status === "lost" ? createdAt + 2 * HOUR : null
        )
      );
    }
    timelineStatements.push(
      env.DB.prepare(
        `INSERT INTO ticket_timeline_events
           (id, occurred_at, ticket_id, title, transition_key, type)
         VALUES (?, ?, ?, 'Ticket confirmed', ?, 'ticket.confirmed')
         ON CONFLICT (transition_key) DO NOTHING`
      ).bind(
        `demo-timeline-${ticket.id}-confirmed`,
        createdAt + 60_000,
        ticket.id,
        `${ticket.id}:seed:confirmed`
      )
    );
    if (settled) {
      timelineStatements.push(
        env.DB.prepare(
          `INSERT INTO ticket_timeline_events
             (id, message, occurred_at, ticket_id, title, transition_key, type)
           VALUES (?, ?, ?, ?, ?, ?, 'ticket.settled')
           ON CONFLICT (transition_key) DO NOTHING`
        ).bind(
          `demo-timeline-${ticket.id}-settled`,
          `Recorded from ${ticket.source}`,
          createdAt + 3 * HOUR,
          ticket.id,
          `Ticket settled ${ticket.status}`,
          `${ticket.id}:seed:settled`
        )
      );
    }
  }
  await env.DB.batch(ticketStatements);
  await env.DB.batch(legStatements);
  await env.DB.batch(timelineStatements);
  return {
    legCount: legStatements.length,
    ticketCount: ticketStatements.length,
    timelineCount: timelineStatements.length,
  };
};

const ensureNotifications = async (
  demoUserId: string,
  now: number
): Promise<number> => {
  await env.DB.batch(
    SEED_NOTIFICATIONS.map((notification) =>
      env.DB.prepare(
        `INSERT INTO notifications
           (body, created_at, id, milestone_key, read_at, ticket_id, title, type, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (milestone_key) DO NOTHING`
      ).bind(
        notification.body,
        now - notification.offset,
        notification.id,
        `demo-seed:${notification.id}`,
        notification.read ? now - notification.offset + 60_000 : null,
        notification.ticketId,
        notification.title,
        notification.type,
        demoUserId
      )
    )
  );
  return SEED_NOTIFICATIONS.length;
};

const ensureCommunities = async (
  directory: UserDirectory,
  now: number
): Promise<{
  channelCount: number;
  communityCount: number;
  memberCount: number;
  messageCount: number;
}> => {
  // Retire rows from an earlier seed run whose ids predated the UUID-format
  // requirement for community messages (replyToId validates as a UUID).
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM community_messages WHERE id LIKE 'demo-message-%'"
    ),
    env.DB.prepare(
      "DELETE FROM community_messages WHERE id LIKE 'demo-reply-%'"
    ),
  ]);

  const communityStatements = [];
  const channelStatements = [];
  const memberStatements = [];
  const messageStatements = [];

  for (const [index, community] of SEED_COMMUNITIES.entries()) {
    const ownerHandle = community.members[0]?.handle;
    if (!ownerHandle) {
      continue;
    }
    communityStatements.push(
      env.DB.prepare(
        `INSERT INTO communities
           (access, created_at, description, id, name, owner_user_id,
            price_cents, rules, slug, updated_at, visibility)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'public')
         ON CONFLICT (id) DO NOTHING`
      ).bind(
        community.access,
        now - (index + 1) * DAY,
        community.description,
        community.id,
        community.name,
        idOf(directory, ownerHandle),
        community.priceCents ?? null,
        community.rules ?? null,
        community.slug,
        now
      )
    );

    if (community.id === "demo-community-courtvision") {
      for (const channel of COURTVISION_CHANNELS) {
        channelStatements.push(
          env.DB.prepare(
            `INSERT INTO community_channels
               (community_id, created_at, description, id, is_archived,
                is_default, name, position, slug, updated_at)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO NOTHING`
          ).bind(
            community.id,
            now - DAY,
            channel.description,
            channel.id,
            channel.position === 0 ? 1 : 0,
            channel.name,
            channel.position,
            channel.slug,
            now
          )
        );
      }
    } else {
      channelStatements.push(
        env.DB.prepare(
          `INSERT INTO community_channels
             (community_id, created_at, description, id, is_archived,
              is_default, name, position, slug, updated_at)
           VALUES (?, ?, ?, ?, 0, 1, 'General', 0, 'general', ?)
           ON CONFLICT (id) DO NOTHING`
        ).bind(
          community.id,
          now - (index + 1) * DAY,
          "Community discussion",
          `demo-channel-${community.slug}`,
          now
        )
      );
    }

    for (const member of community.members) {
      memberStatements.push(
        env.DB.prepare(
          `INSERT INTO community_members
             (community_id, joined_at, role, status, updated_at, user_id)
           VALUES (?, ?, ?, 'active', ?, ?)
           ON CONFLICT (community_id, user_id) DO NOTHING`
        ).bind(
          community.id,
          now - index * DAY,
          member.role,
          now,
          idOf(directory, member.handle)
        )
      );
    }

    const seededChannelMessages: {
      channelId: string;
      messages: SeedMessage[];
    }[] = [];
    if (community.id === "demo-community-courtvision") {
      seededChannelMessages.push(
        {
          channelId: "demo-channel-live-sweats",
          messages: community.messages ?? [],
        },
        { channelId: "demo-channel-vip-picks", messages: VIP_PICKS_MESSAGES },
        { channelId: "demo-channel-general", messages: GENERAL_MESSAGES }
      );
    }
    for (const channel of seededChannelMessages) {
      for (const message of channel.messages) {
        messageStatements.push(
          env.DB.prepare(
            `INSERT INTO community_messages
               (author_user_id, body, channel_id, community_id, created_at,
                id, mentions, reply_to_id)
             VALUES (?, ?, ?, ?, ?, ?, '[]', NULL)
             ON CONFLICT (id) DO NOTHING`
          ).bind(
            idOf(directory, message.authorHandle),
            message.body,
            channel.channelId,
            community.id,
            now - message.offset,
            message.id
          )
        );
        for (const reply of message.replies ?? []) {
          messageStatements.push(
            env.DB.prepare(
              `INSERT INTO community_messages
                 (author_user_id, body, channel_id, community_id, created_at,
                  id, mentions, reply_to_id)
               VALUES (?, ?, ?, ?, ?, ?, '[]', ?)
               ON CONFLICT (id) DO NOTHING`
            ).bind(
              idOf(directory, reply.authorHandle),
              reply.body,
              channel.channelId,
              community.id,
              now - reply.offset,
              reply.id,
              message.id
            )
          );
        }
      }
    }
  }

  await env.DB.batch(communityStatements);
  await env.DB.batch(channelStatements);
  await env.DB.batch(memberStatements);
  // Parents are inserted before their replies inside the same batch, so the
  // reply_to_id references resolve in order.
  await env.DB.batch(messageStatements);

  return {
    channelCount: channelStatements.length,
    communityCount: communityStatements.length,
    memberCount: memberStatements.length,
    messageCount: messageStatements.length,
  };
};

export const seedDemoData = async (
  auth: Auth
): Promise<SeedSummary & { password: string }> => {
  const now = Date.now();
  const directory = await ensureUsers(auth);
  const demoUserId = idOf(directory, "courtvision_picks");
  const follows = await ensureProfilesAndFollows(directory, now);
  await ensureEntitlementAndPreferences(demoUserId, now);
  const tickets = await ensureTickets(demoUserId, now);
  const notifications = await ensureNotifications(demoUserId, now);
  const communities = await ensureCommunities(directory, now);
  return {
    channels: communities.channelCount,
    communities: communities.communityCount,
    follows,
    members: communities.memberCount,
    messages: communities.messageCount,
    notifications,
    password: DEMO_PASSWORD,
    ticketLegs: tickets.legCount,
    tickets: tickets.ticketCount,
    timelineEvents: tickets.timelineCount,
    users: directory.createdEmails,
  };
};
