import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard } from "@/components/ui/glass-card";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import {
  BettorProfileModal,
  type BettorProfileData,
} from "@/components/ui/bettor-profile-modal";
import { TicketDetailModal } from "@/components/ui/ticket-detail-modal";
import type { CommunityMessageItem, MobileTicket } from "@/lib/api-client";
import {
  createCommunity,
  createCommunityChannel,
  fetchChannelThreadPage,
  fetchCommunityMembers,
  joinCommunity,
  sendCommunityMessage,
  toggleMessageReaction,
  useCommunitiesDirectory,
  useCommunityData,
  useDashboardData,
  type CommunityDirectoryItem,
} from "@/lib/api-client";
import { isDemoUser, useAppState } from "@/lib/app-state";

const DIRECTORY_COMMUNITIES: CommunityDirectoryItem[] = [
  {
    activeChannel: "live-sweats",
    avatar: "SE",
    creator: "cgstewart",
    description:
      "Data-backed NBA player props, rebounds analysis, and fourth-quarter live sweat threads.",
    id: "sharp-edge",
    isJoined: true,
    memberCount: 4280,
    name: "The Sharp Edge",
    onlineCount: 342,
    sport: "NBA",
    unreadCount: 3,
  },
  {
    activeChannel: "totals-lab",
    avatar: "OU",
    creator: "propchemist",
    description:
      "Mathematical totals and pace regressions for NBA and college basketball.",
    id: "over-under-labs",
    isJoined: true,
    memberCount: 1840,
    name: "Over/Under Labs",
    onlineCount: 95,
    sport: "CBB & NBA",
  },
  {
    activeChannel: "redzone-picks",
    avatar: "CK",
    creator: "gridironguru",
    description:
      "High-probability touchdown scorers, receiving yards, and NFL Sunday sweat rooms.",
    id: "touchdown-sweats",
    isJoined: false,
    memberCount: 6510,
    name: "Touchdown Sweats",
    onlineCount: 512,
    price: "19.99 / mo",
    sport: "NFL",
  },
  {
    activeChannel: "model-outputs",
    avatar: "DM",
    creator: "quantbets",
    description:
      "Algorithmic model projections running Monte Carlo simulations across all major leagues.",
    id: "quant-models",
    isJoined: false,
    memberCount: 3200,
    name: "Quant Prop Models",
    onlineCount: 180,
    sport: "Multi-Sport",
  },
  {
    activeChannel: "puck-sweats",
    avatar: "IP",
    creator: "slapshot",
    description:
      "NHL shot-on-goal edges, powerplay props, and goalie saves regression analysis.",
    id: "ice-puck-sharps",
    isJoined: false,
    memberCount: 2150,
    name: "Ice Puck Sharps",
    onlineCount: 120,
    sport: "NHL",
  },
  {
    activeChannel: "strikeout-lab",
    avatar: "DP",
    creator: "pitcher_props",
    description:
      "Starting pitcher strikeout totals, barrel rates, and ballpark weather adjustments.",
    id: "diamond-props",
    isJoined: false,
    memberCount: 4790,
    name: "Diamond Props & Ks",
    onlineCount: 285,
    price: "24.99 / mo",
    sport: "MLB",
  },
  {
    activeChannel: "pitch-sweat",
    avatar: "CS",
    creator: "tactical_footy",
    description:
      "Premier League and UCL corner counts, card totals, and shot-on-target systems.",
    id: "corner-syndicate",
    isJoined: false,
    memberCount: 3880,
    name: "Corner & Goals Syndicate",
    onlineCount: 210,
    sport: "Soccer",
  },
  {
    activeChannel: "whale-lounge",
    avatar: "HR",
    creator: "highroller_king",
    description:
      "High-volume verified unit slips, line shopping across all books, and late steam alerts.",
    id: "high-rollers-club",
    isJoined: false,
    memberCount: 1420,
    name: "High Roller Props",
    onlineCount: 94,
    price: "49.99 / mo",
    sport: "High Rollers",
  },
];

const COMMUNITY_RULES = [
  {
    desc: "Every posted ticket must be verified via screenshot or API sync. No edited slips.",
    title: "1. 100% Slip Verification",
  },
  {
    desc: "We discuss prop edges, player usage, and game gameplans. Keep discussion focused on stats.",
    title: "2. Analytical Discussions Only",
  },
  {
    desc: "Celebrate cashes and endure bad beats together. Zero abuse or toxicity tolerated.",
    title: "3. Respect the Community",
  },
  {
    desc: "Spamming affiliate links, off-platform payment requests, or unverified claims will result in immediate bans.",
    title: "4. No Solicitation or External Links",
  },
];

const COMMUNITY_MEMBERS = [
  { handle: "@cgstewart", name: "Cameron Stewart", role: "Creator · Admin" },
  { handle: "@marcus_prop", name: "Marcus Rivera", role: "Moderator" },
  { handle: "@baller_jay", name: "Jaylen Brooks", role: "VIP Member" },
  { handle: "@statline_sarah", name: "Sarah Chen", role: "VIP Member" },
  { handle: "@boston_dan", name: "Dan Sullivan", role: "Member" },
];

const SAMPLE_MARCUS_TICKETS: MobileTicket[] = [
  {
    createdAt: new Date().toISOString(),
    id: "tkt_m1",
    legs: [
      {
        currentValue: 27,
        id: "leg_m1",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 25.5 Points",
        status: "won",
        subjectName: "Anthony Edwards",
        targetValue: 25.5,
        wonAt: "4Q 3:10",
      },
      {
        currentValue: 6,
        id: "leg_m2",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 5.5 Assists",
        status: "won",
        subjectName: "Mike Conley",
        targetValue: 5.5,
        wonAt: "4Q 1:15",
      },
      {
        currentValue: 11,
        id: "leg_m3",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 9.5 Rebounds",
        status: "won",
        subjectName: "Rudy Gobert",
        targetValue: 9.5,
        wonAt: "3Q 0:40",
      },
    ],
    odds: "",
    originalStake: 50,
    sourceName: "DraftKings",
    sportsEvent: "MIN Timberwolves @ SAC Kings",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date().toISOString(),
    id: "tkt_m2",
    legs: [
      {
        currentValue: 28,
        id: "leg_m4",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 26.5 Points",
        status: "won",
        subjectName: "Jayson Tatum",
        targetValue: 26.5,
        wonAt: "3Q 2:00",
      },
      {
        currentValue: 11,
        id: "leg_m5",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 9.5 Assists",
        status: "won",
        subjectName: "Tyrese Haliburton",
        targetValue: 9.5,
        wonAt: "4Q 1:12",
      },
      {
        currentValue: 8,
        id: "leg_m6",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 6.5 Rebounds",
        status: "won",
        subjectName: "Myles Turner",
        targetValue: 6.5,
        wonAt: "4Q 0:45",
      },
    ],
    odds: "",
    originalStake: 40,
    sourceName: "FanDuel",
    sportsEvent: "BOS Celtics @ IND Pacers",
    status: "won",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    id: "tkt_m3",
    legs: [
      {
        currentValue: 31,
        id: "leg_m7",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 28.5 Points",
        status: "won",
        subjectName: "Devin Booker",
        targetValue: 28.5,
        wonAt: "4Q 1:10",
      },
      {
        currentValue: 4,
        id: "leg_m8",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 6.5 Assists",
        status: "lost",
        subjectName: "Bradley Beal",
        targetValue: 6.5,
        lostAt: "Final",
      },
    ],
    odds: "",
    originalStake: 45,
    sourceName: "BetMGM",
    sportsEvent: "PHX Suns @ DAL Mavericks",
    status: "lost",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    id: "tkt_m4",
    legs: [
      {
        currentValue: 22,
        id: "leg_m9",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 24.5 Points",
        status: "lost",
        subjectName: "Kawhi Leonard",
        targetValue: 24.5,
        lostAt: "Final",
      },
      {
        currentValue: 9,
        id: "leg_m10",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 8.5 Rebounds",
        status: "won",
        subjectName: "Ivica Zubac",
        targetValue: 8.5,
        wonAt: "4Q 2:20",
      },
    ],
    odds: "",
    originalStake: 30,
    sourceName: "DraftKings",
    sportsEvent: "LAC Clippers @ DEN Nuggets",
    status: "lost",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
];

const SAMPLE_SARAH_TICKETS: MobileTicket[] = [
  {
    createdAt: new Date().toISOString(),
    id: "tkt_s1",
    legs: [
      {
        currentValue: 8,
        id: "leg_s1",
        marketDescription: "Strikeouts",
        operator: "over",
        rawDescription: "Over 6.5 Strikeouts",
        status: "won",
        subjectName: "Paul Skenes",
        targetValue: 6.5,
        wonAt: "Top 6th",
      },
      {
        currentValue: 2,
        id: "leg_s2",
        marketDescription: "Total Bases",
        operator: "over",
        rawDescription: "Over 1.5 Total Bases",
        status: "won",
        subjectName: "Shohei Ohtani",
        targetValue: 1.5,
        wonAt: "Bot 4th",
      },
      {
        currentValue: 7,
        id: "leg_s3",
        marketDescription: "Strikeouts",
        operator: "over",
        rawDescription: "Over 5.5 Strikeouts",
        status: "won",
        subjectName: "Tarik Skubal",
        targetValue: 5.5,
        wonAt: "Top 5th",
      },
    ],
    odds: "",
    originalStake: 50,
    sourceName: "DraftKings",
    sportsEvent: "LAD Dodgers @ PIT Pirates",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date().toISOString(),
    id: "tkt_s2",
    legs: [
      {
        currentValue: 24,
        id: "leg_s4",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 22.5 Points",
        status: "won",
        subjectName: "A'ja Wilson",
        targetValue: 22.5,
        wonAt: "3Q 1:10",
      },
      {
        currentValue: 8,
        id: "leg_s5",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 9.5 Rebounds",
        status: "lost",
        subjectName: "Breanna Stewart",
        targetValue: 9.5,
        lostAt: "Final",
      },
    ],
    odds: "",
    originalStake: 35,
    sourceName: "FanDuel",
    sportsEvent: "LVA Aces @ NY Liberty",
    status: "lost",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    id: "tkt_s3",
    legs: [
      {
        currentValue: 22,
        id: "leg_s6",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 19.5 Points",
        status: "won",
        subjectName: "Caitlin Clark",
        targetValue: 19.5,
        wonAt: "4Q 3:15",
      },
      {
        currentValue: 7,
        id: "leg_s7",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 5.5 Assists",
        status: "won",
        subjectName: "Sabrina Ionescu",
        targetValue: 5.5,
        wonAt: "4Q 1:20",
      },
    ],
    odds: "",
    originalStake: 40,
    sourceName: "DraftKings",
    sportsEvent: "IND Fever @ NY Liberty",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
];

const SAMPLE_GURU_TICKETS: MobileTicket[] = [
  {
    createdAt: new Date().toISOString(),
    id: "tkt_g1",
    legs: [
      {
        currentValue: 2,
        id: "leg_g1",
        marketDescription: "Anytime Touchdown",
        operator: "over",
        rawDescription: "Derrick Henry Anytime TD",
        status: "won",
        subjectName: "Derrick Henry",
        targetValue: 1,
        wonAt: "2Q 3:15",
      },
      {
        currentValue: 1,
        id: "leg_g2",
        marketDescription: "Anytime Touchdown",
        operator: "over",
        rawDescription: "Travis Kelce Anytime TD",
        status: "won",
        subjectName: "Travis Kelce",
        targetValue: 1,
        wonAt: "4Q 6:40",
      },
      {
        currentValue: 1,
        id: "leg_g3",
        marketDescription: "Anytime Touchdown",
        operator: "over",
        rawDescription: "Amon-Ra St. Brown TD",
        status: "won",
        subjectName: "Amon-Ra St. Brown",
        targetValue: 1,
        wonAt: "3Q 8:12",
      },
    ],
    odds: "",
    originalStake: 60,
    sourceName: "DraftKings",
    sportsEvent: "NFL RedZone Sweat Sunday",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    id: "tkt_g2",
    legs: [
      {
        currentValue: 1,
        id: "leg_g4",
        marketDescription: "Anytime Touchdown",
        operator: "over",
        rawDescription: "Christian McCaffrey Anytime TD",
        status: "won",
        subjectName: "Christian McCaffrey",
        targetValue: 1,
        wonAt: "1Q 5:10",
      },
      {
        currentValue: 0,
        id: "leg_g5",
        marketDescription: "Anytime Touchdown",
        operator: "over",
        rawDescription: "Deebo Samuel Anytime TD",
        status: "lost",
        subjectName: "Deebo Samuel",
        targetValue: 1,
        lostAt: "Final",
      },
    ],
    odds: "",
    originalStake: 50,
    sourceName: "FanDuel",
    sportsEvent: "SF 49ers @ LAR Rams",
    status: "lost",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
];

const TOP_BETTORS_DIRECTORY: BettorProfileData[] = [
  {
    avatar: "MR",
    bio: "NBA Player Prop analyst. Heavy focus on 1Q spreads, rebound pace, and 4Q sweat threads. Transparent tracked history.",
    followersCount: "3.4k",
    handle: "marcus_prop",
    hitRate: "72%",
    id: "bettor_marcus",
    isFollowing: false,
    isVerified: true,
    name: "Marcus Rivera",
    slipsCount: 184,
    socialProof: {
      avatarInitials: ["SC", "GG", "CS"],
      followedByText: "Followed by cgstewart, statline_sarah and 58 others",
    },
    specialty: "NBA Player Props",
    syndicateHub: {
      description: "Data-backed NBA player props and fourth-quarter live sweat threads.",
      id: "sharp-edge",
      membersCount: "4.2k",
      name: "The Sharp Edge",
    },
    tags: ["🏀 NBA Props", "📊 1Q Spreads", "⚡️ Live Sweats"],
    tickets: SAMPLE_MARCUS_TICKETS,
  },
  {
    avatar: "SC",
    bio: "WNBA & MLB sabermetrics analyst. Strikeout regressions and batter total bases angles.",
    followersCount: "2.1k",
    handle: "statline_sarah",
    hitRate: "69%",
    id: "bettor_sarah",
    isFollowing: true,
    isVerified: true,
    name: "Sarah Chen",
    slipsCount: 215,
    socialProof: {
      avatarInitials: ["MR", "CS", "GG"],
      followedByText: "Followed by marcus_prop, cgstewart and 34 others",
    },
    specialty: "WNBA & MLB Hits",
    syndicateHub: {
      description: "Mathematical totals and pace regressions for NBA and college basketball.",
      id: "over-under-labs",
      membersCount: "1.8k",
      name: "Over/Under Labs",
    },
    tags: ["⚾ MLB Hits", "🏀 WNBA Props", "📈 K-Props"],
    tickets: SAMPLE_SARAH_TICKETS,
  },
  {
    avatar: "GG",
    bio: "NFL redzone specialist. Anytime TD regression models, receiving yard lines, and Sunday sweat rooms.",
    followersCount: "5.8k",
    handle: "gridironguru",
    hitRate: "65%",
    id: "bettor_guru",
    isFollowing: false,
    isVerified: true,
    name: "Gridiron Guru",
    slipsCount: 310,
    socialProof: {
      avatarInitials: ["MR", "SC", "CS"],
      followedByText: "Followed by marcus_prop, statline_sarah and 120 others",
    },
    specialty: "NFL Touchdown Sweats",
    syndicateHub: {
      description: "High-probability touchdown scorers and receiving yards sweat rooms.",
      id: "touchdown-sweats",
      membersCount: "6.5k",
      name: "Touchdown Sweats",
    },
    tags: ["🏈 NFL Props", "🎯 AnyTime TD", "⚡️ RedZone"],
    tickets: SAMPLE_GURU_TICKETS,
  },
  {
    avatar: "CS",
    bio: "NBA player prop specialist. Heavy focus on rebounds and assists. Syndicate founder.",
    followersCount: "1.8k",
    handle: "cgstewart",
    hitRate: "68%",
    id: "bettor_cameron",
    isFollowing: false,
    isVerified: true,
    name: "Cameron Stewart",
    slipsCount: 142,
    socialProof: {
      avatarInitials: ["MR", "SC", "GG"],
      followedByText: "Followed by marcus_prop, baller_jay and 42 others",
    },
    specialty: "NBA Prop Specialist",
    syndicateHub: {
      description: "Data-backed NBA player props and fourth-quarter live sweat threads.",
      id: "sharp-edge",
      membersCount: "4.2k",
      name: "The Sharp Edge",
    },
    tags: ["🏀 NBA Props", "⚾ MLB Hits", "🏈 RedZone"],
    tickets: SAMPLE_MARCUS_TICKETS,
  },
];

const getBettorProfile = (handleOrName: string): BettorProfileData => {
  const clean = handleOrName.replace(/^@/, "").toLowerCase();
  const match = TOP_BETTORS_DIRECTORY.find(
    (b) =>
      b.handle.toLowerCase() === clean ||
      b.name.toLowerCase() === clean ||
      b.id.toLowerCase().includes(clean)
  );
  if (match) return match;
  return {
    avatar: handleOrName.slice(0, 2).toUpperCase(),
    bio: "Active syndicate bettor sharing verified props on ParlayPal.",
    followersCount: "940",
    handle: clean,
    hitRate: "64%",
    id: `bettor_${clean}`,
    isFollowing: false,
    isVerified: true,
    name: handleOrName.startsWith("@") ? handleOrName.slice(1) : handleOrName,
    slipsCount: 68,
    socialProof: {
      avatarInitials: ["MR", "CS"],
      followedByText: "Followed by cgstewart and 12 others",
    },
    specialty: "Props Enthusiast",
    tags: ["🏀 NBA Props", "🔥 Sweats"],
    tickets: SAMPLE_MARCUS_TICKETS,
  };
};

export default function CommunitiesScreen() {
  const { user } = useAppState();
  const isDemo = isDemoUser(user);

  // All Communities State (allows creating, joining, and filtering)
  const [allCommunities, setAllCommunities] =
    useState<CommunityDirectoryItem[]>(DIRECTORY_COMMUNITIES);

  // Selected Community ID: null = Discovery Directory, string = Chat Room ID View
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(
    null
  );

  // Real accounts hydrate the directory from the API; demo keeps fixtures.
  const directoryQuery = useCommunitiesDirectory(!isDemo);
  const { data: directoryData } = directoryQuery;
  useEffect(() => {
    if (directoryData) {
      setAllCommunities([
        ...directoryData.joined,
        ...directoryData.discover,
      ]);
    }
  }, [directoryData]);

  // The active room's slug (real accounts use the community slug as id).
  const activeSlug = activeCommunityId
    ? allCommunities.find((c) => c.id === activeCommunityId)?.id ?? null
    : null;
  const { data: community } = useCommunityData(
    isDemo ? undefined : (activeSlug ?? undefined)
  );
  const { data: dashboardData } = useDashboardData();

  // Chat Room state
  const [activeChannelId, setActiveChannelId] = useState("live-sweats");
  const [inputText, setInputText] = useState("");
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [followedPick, setFollowedPick] = useState(false);
  const [attachedSlip, setAttachedSlip] = useState<MobileTicket | null>(null);

  // Unread pill + cursor pagination (real features backed by the server)
  const chatScrollRef = useRef<ScrollView>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isAtBottomRef = useRef(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [olderByChannel, setOlderByChannel] = useState<
    Record<string, CommunityMessageItem[]>
  >({});
  const [cursorByChannel, setCursorByChannel] = useState<
    Record<string, string | null>
  >({});
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [communityMembers, setCommunityMembers] = useState(COMMUNITY_MEMBERS);

  // Keyboard and composer references
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const composerInputRef = useRef<TextInput>(null);

  // Slack Thread View Modal state
  const [activeThreadMessage, setActiveThreadMessage] =
    useState<CommunityMessageItem | null>(null);
  const [threadInputText, setThreadInputText] = useState("");
  const [replyingToUser, setReplyingToUser] = useState<string | null>(null);
  const [alsoSendToChannel, setAlsoSendToChannel] = useState(false);

  // Modals inside chat room
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isShareSlipPickerOpen, setIsShareSlipPickerOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MobileTicket | null>(
    null
  );

  // Public Bettor Profile Modal state (Instagram style)
  const [selectedBettorProfile, setSelectedBettorProfile] =
    useState<BettorProfileData | null>(null);

  // Slack Attachment Menu, Photo Permission & Emoji Picker states
  const [isSlackAttachmentMenuOpen, setIsSlackAttachmentMenuOpen] =
    useState(false);
  const [isPhotoPermissionModalOpen, setIsPhotoPermissionModalOpen] =
    useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);

  // Discovery Directory Modal & Controls
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchDirectory, setSearchDirectory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isDiscoverGridView, setIsDiscoverGridView] = useState(true);

  // Create Community Form State
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createSport, setCreateSport] = useState("NBA");
  const [createAccessType, setCreateAccessType] = useState<"free" | "paid">(
    "free"
  );
  const [createPrice, setCreatePrice] = useState("19.99 / mo");
  const [createChannelPreset, setCreateChannelPreset] = useState<
    "standard" | "vip" | "custom"
  >("standard");
  const [createCustomChannels, setCreateCustomChannels] = useState("");
  const [createNotifyRule, setCreateNotifyRule] = useState<
    "slips_only" | "all" | "mentions_only"
  >("slips_only");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsRulesModalOpen(false);
        setIsMembersModalOpen(false);
        setIsShareSlipPickerOpen(false);
        setIsSlackAttachmentMenuOpen(false);
        setIsPhotoPermissionModalOpen(false);
        setIsEmojiPickerOpen(false);
        setSelectedBettorProfile(null);
        setIsCreateModalOpen(false);
        setSelectedTicket(null);
        setActiveCommunityId(null);
        setActiveThreadMessage(null);
        setReplyingToUser(null);
        setAttachedSlip(null);
        setAttachedPhoto(null);
      };
    }, [])
  );

  const initialMessages =
    community?.messages[activeChannelId] ??
    community?.messages["live-sweats"] ??
    [];
  const [messages, setMessages] =
    useState<CommunityMessageItem[]>(initialMessages);
  // Displayed feed: any cursor-loaded older pages, then the latest page.
  const chatMessages = [
    ...(olderByChannel[activeChannelId] ?? []),
    ...messages,
  ];

  const channels = community?.channels ?? [];
  const pinnedSlip = community?.pinnedSlip;
  const userTickets = dashboardData?.tickets ?? [];

  // Real accounts: follow the live room data — snap to the first real channel
  // and reflect server messages for the active channel. Demo keeps its local
  // fixture flow (including the room-bot welcome messages).
  useEffect(() => {
    if (isDemo) {
      return;
    }
    if (
      channels.length > 0 &&
      !channels.some((channel) => channel.id === activeChannelId)
    ) {
      setActiveChannelId(channels[0].id);
      return;
    }
    setMessages(community?.messages[activeChannelId] ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- community data identity changes only on refetch
  }, [community, activeChannelId, channels, isDemo]);

  // Keep per-channel "load earlier" cursors in sync with room data.
  useEffect(() => {
    if (community?.cursors) {
      setCursorByChannel(community.cursors);
    }
  }, [community]);

  // Real accounts see the actual roster in the members modal.
  useEffect(() => {
    if (!isDemo && isMembersModalOpen && activeSlug) {
      void fetchCommunityMembers(activeSlug).then(setCommunityMembers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per modal open
  }, [isMembersModalOpen, isDemo, activeSlug]);

  // Unread pill: messages that arrived while the feed was scrolled up.
  useEffect(() => {
    if (isAtBottomRef.current) {
      for (const msg of messages) {
        seenIdsRef.current.add(msg.id);
      }
      setUnreadCount(0);
    } else {
      setUnreadCount(
        messages.filter((msg) => !seenIdsRef.current.has(msg.id)).length
      );
    }
  }, [messages]);

  const handleChannelSelect = (channelId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveChannelId(channelId);
    // A fresh channel starts at the bottom of its feed.
    isAtBottomRef.current = true;
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd({ animated: false });
    });
    const channelMsgs =
      community?.messages[channelId] ??
      (channelId === "live-sweats"
        ? (community?.messages["live-sweats"] ?? [])
        : [
            {
              authorHandle: "@system",
              authorName: "ParlayPal Room Bot",
              content: `Welcome to #${channelId}. Share verified slips and discuss sharp props with fellow syndicates.`,
              id: `sys_${channelId}`,
              reactions: [{ count: 3, emoji: "👋" }],
              roleBadge: "AGENT",
              timestamp: "Today",
            },
          ]);
    setMessages(channelMsgs);
  };

  const handleSendMessage = async (slipToSend?: MobileTicket) => {
    const finalSlip = slipToSend ?? attachedSlip;
    const finalPhoto = attachedPhoto;
    if (!inputText.trim() && !finalSlip && !finalPhoto) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newMsg: CommunityMessageItem = {
      authorHandle: "@cgstewart",
      authorName: "Cameron Stewart",
      content:
        inputText.trim() ||
        (finalPhoto
          ? `Shared photo: ${finalPhoto}`
          : "Shared a verified ticket to the room."),
      id: `msg_${Date.now()}`,
      reactions: [{ count: 1, emoji: "🔥" }],
      roleBadge: "CREATOR",
      ticketAttachment: finalSlip
        ? {
            id: finalSlip.id,
            legsCount: finalSlip.legs?.length ?? 0,
            odds: "",
            summary: `${finalSlip.sourceName} · ${finalSlip.sportsEvent}`,
          }
        : undefined,
      timestamp: "Just now",
    };

    if (!isDemo && activeSlug) {
      // Real account: persist the message through the REST chat route so
      // every connected client (including web) receives the broadcast.
      const sent = await sendCommunityMessage({
        body: newMsg.content,
        channelId: activeChannelId,
        replyToId: null,
        slug: activeSlug,
      });
      setMessages((prev) => [...prev, sent ?? newMsg]);
    } else {
      setMessages((prev) => [...prev, newMsg]);
    }
    setInputText("");
    setAttachedSlip(null);
    setAttachedPhoto(null);
    setIsShareSlipPickerOpen(false);
    setIsSlackAttachmentMenuOpen(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsComposerFocused(false);
    composerInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleSendThreadReply = async () => {
    if (!threadInputText.trim() || !activeThreadMessage) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const replyMsg: CommunityMessageItem = {
      authorHandle: "@cgstewart",
      authorName: "Cameron Stewart",
      content: threadInputText.trim(),
      id: `rep_${Date.now()}`,
      reactions: [{ count: 1, emoji: "🔥" }],
      roleBadge: "CREATOR",
      timestamp: "Just now",
    };

    // Real accounts persist the thread reply with replyToId so every client
    // groups it under the same parent.
    let savedReply = replyMsg;
    if (!isDemo && activeSlug) {
      const sent = await sendCommunityMessage({
        body: threadInputText.trim(),
        channelId: activeChannelId,
        replyToId: activeThreadMessage.id,
        slug: activeSlug,
      });
      if (sent) {
        savedReply = sent;
      }
    }

    const updatedParent: CommunityMessageItem = {
      ...activeThreadMessage,
      lastReplyTime: "Just now",
      replies: [...(activeThreadMessage.replies ?? []), savedReply],
      repliesCount: (activeThreadMessage.repliesCount ?? 0) + 1,
    };

    setActiveThreadMessage(updatedParent);

    // Update parent message in the messages list
    setMessages((prev) =>
      prev.map((m) => (m.id === activeThreadMessage.id ? updatedParent : m))
    );

    // Also post to main channel feed if checked
    if (alsoSendToChannel) {
      setMessages((prev) => [...prev, savedReply]);
    }

    setThreadInputText("");
    setReplyingToUser(null);
    Keyboard.dismiss();
  };

  /** Apply authoritative reaction state to a root or thread reply. */
  const applyReactions = (
    msgId: string,
    reactions: CommunityMessageItem["reactions"]
  ) => {
    const update = (msg: CommunityMessageItem): CommunityMessageItem =>
      msg.id === msgId
        ? { ...msg, reactions }
        : msg.replies?.some((reply) => reply.id === msgId)
          ? {
              ...msg,
              replies: msg.replies.map((reply) =>
                reply.id === msgId ? { ...reply, reactions } : reply
              ),
            }
          : msg;
    setMessages((prev) => prev.map(update));
    setOlderByChannel((prev) => {
      const page = prev[activeChannelId];
      return page ? { ...prev, [activeChannelId]: page.map(update) } : prev;
    });
  };

  const handleReactionPress = async (msgId: string, emoji: string) => {
    await Haptics.selectionAsync().catch(() => {});
    if (!isDemo && activeSlug) {
      // Real account: the server toggles and returns the authoritative
      // reaction state (broadcast live to connected web clients too).
      const reactions = await toggleMessageReaction({
        channelId: activeChannelId,
        emoji,
        messageId: msgId,
        slug: activeSlug,
      });
      if (reactions) {
        applyReactions(msgId, reactions);
      }
      return;
    }
    // Demo account keeps the local optimistic behavior.
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId) {
          const existing = msg.reactions.find((r) => r.emoji === emoji);
          if (existing) {
            return {
              ...msg,
              reactions: msg.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1 } : r
              ),
            };
          }
          return {
            ...msg,
            reactions: [...msg.reactions, { count: 1, emoji }],
          };
        }
        return msg;
      })
    );
  };

  const handleChatScroll = (event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const atBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      for (const msg of messages) {
        seenIdsRef.current.add(msg.id);
      }
      setUnreadCount(0);
    }
  };

  const handleJumpToUnread = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    isAtBottomRef.current = true;
    for (const msg of messages) {
      seenIdsRef.current.add(msg.id);
    }
    setUnreadCount(0);
    chatScrollRef.current?.scrollToEnd({ animated: true });
  };

  const handleLoadOlder = async () => {
    const cursor = cursorByChannel[activeChannelId];
    if (!cursor || !activeSlug || loadingOlder) {
      return;
    }
    setLoadingOlder(true);
    const page = await fetchChannelThreadPage({
      channelId: activeChannelId,
      cursor,
      slug: activeSlug,
    });
    if (page) {
      setOlderByChannel((prev) => ({
        ...prev,
        [activeChannelId]: [
          ...page.messages,
          ...(prev[activeChannelId] ?? []),
        ],
      }));
      setCursorByChannel((prev) => ({
        ...prev,
        [activeChannelId]: page.nextCursor,
      }));
      // Explicitly requested history never counts as unread.
      for (const msg of page.messages) {
        seenIdsRef.current.add(msg.id);
      }
    } else {
      setCursorByChannel((prev) => ({ ...prev, [activeChannelId]: null }));
    }
    setLoadingOlder(false);
  };

  const handleJoinCommunity = async (commId: string) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!isDemo) {
      const result = await joinCommunity(commId);
      if (result.checkoutUrl) {
        // Paid community: finish the Stripe checkout in the system browser,
        // then the deep-link return re-syncs membership on focus.
        await WebBrowser.openBrowserAsync(result.checkoutUrl);
        return;
      }
      if (!result.joined) {
        // Pending approval or gated; open the room view read-only for now.
        setAllCommunities((prev) =>
          prev.map((c) => (c.id === commId ? { ...c, isJoined: true } : c))
        );
        setActiveCommunityId(commId);
        return;
      }
      setAllCommunities((prev) =>
        prev.map((c) => (c.id === commId ? { ...c, isJoined: true } : c))
      );
      setActiveCommunityId(commId);
      await directoryQuery.refetch();
      return;
    }
    setAllCommunities((prev) =>
      prev.map((c) => (c.id === commId ? { ...c, isJoined: true } : c))
    );
    setActiveCommunityId(commId);
  };

  const handleLaunchCommunity = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newId =
      createSlug.trim().toLowerCase() ||
      `syndicate-${Date.now().toString().slice(-4)}`;

    if (!isDemo) {
      // Real account: create the community on the server (Creator plan
      // required), then seed the chosen channel preset.
      const created = await createCommunity({
        access: createAccessType,
        description: createDesc.trim() || null,
        name: createName.trim() || "Sharp Syndicate Club",
        priceCents:
          createAccessType === "paid"
            ? Math.round(Number.parseFloat(createPrice) * 100) || null
            : null,
        slug: newId,
      });
      if (!created.community) {
        setCreateError(
          created.error ?? "Unable to create the community right now"
        );
        return;
      }
      if (createChannelPreset === "vip") {
        await createCommunityChannel(newId, {
          name: "Creator Picks",
          slug: "creator-picks",
        });
      } else if (createChannelPreset === "custom") {
        const channelNames = createCustomChannels
          .split(/[,\\n]/u)
          .map((entry) => entry.trim())
          .filter(Boolean);
        for (const channelName of channelNames.slice(0, 10)) {
          await createCommunityChannel(newId, {
            name: channelName,
            slug: channelName
              .toLowerCase()
              .replace(/[^a-z0-9]+/gu, "-")
              .replace(/^-+|-+$/gu, ""),
          });
        }
      }
      await directoryQuery.refetch();
      setCreateError(null);
      setIsCreateModalOpen(false);
      setCreateName("");
      setCreateSlug("");
      setCreateDesc("");
      setActiveCommunityId(newId);
      return;
    }

    const newCommunity: CommunityDirectoryItem = {
      activeChannel:
        createChannelPreset === "vip" ? "creator-picks" : "live-sweats",
      avatar: (createName.trim() || "SY").slice(0, 2).toUpperCase(),
      creator: "cgstewart",
      description:
        createDesc.trim() ||
        "Private betting syndicate discussing sharp props, high-probability angles, and live legs.",
      id: newId,
      isJoined: true,
      isPaid: createAccessType === "paid",
      memberCount: 1,
      name: createName.trim() || "Sharp Syndicate Club",
      onlineCount: 1,
      price: createAccessType === "paid" ? createPrice : undefined,
      sport: createSport,
    };

    setAllCommunities((prev) => [newCommunity, ...prev]);
    setIsCreateModalOpen(false);
    setCreateName("");
    setCreateSlug("");
    setCreateDesc("");
    setActiveCommunityId(newCommunity.id);
  };

  const activeCommunity =
    allCommunities.find((c) => c.id === activeCommunityId) ??
    allCommunities[0];

  // ==========================================
  // VIEW 1: COMMUNITIES DISCOVERY & DIRECTORY
  // ==========================================
  if (!activeCommunityId) {
    const matchesCategory = (c: CommunityDirectoryItem) => {
      if (selectedCategory === "All") return true;
      return c.sport.toLowerCase().includes(selectedCategory.toLowerCase());
    };
    const matchesQuery = (c: CommunityDirectoryItem) => {
      if (!searchDirectory.trim()) return true;
      const q = searchDirectory.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        c.sport.toLowerCase().includes(q) ||
        c.creator.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    };

    const joinedCommunities = allCommunities.filter(
      (c) => c.isJoined && matchesCategory(c) && matchesQuery(c)
    );
    const discoverCommunities = allCommunities.filter(
      (c) => !c.isJoined && matchesCategory(c) && matchesQuery(c)
    );

    return (
      <SafeAreaView
        className="flex-1 bg-zinc-950"
        style={{ backgroundColor: "#09090b", flex: 1 }}
      >
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{
            paddingBottom: Platform.OS === "ios" ? 110 : 90,
            paddingTop: 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with "+ Create Community" Button on Discovery View */}
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
                BETTOR HUBS & SYNDICATES
              </Text>
              <Text className="mt-0.5 text-2xl font-black tracking-tight text-white">
                Communities
              </Text>
            </View>

            <HapticPressable
              className="flex-row items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 shadow-sm shadow-emerald-500/25"
              onPress={() => setIsCreateModalOpen(true)}
            >
              <Ionicons name="add" size={16} color="#09090b" />
              <Text className="text-xs font-bold text-zinc-950">
                New Community
              </Text>
            </HapticPressable>
          </View>

          <Text className="mb-4 text-xs text-zinc-400">
            Join sharp betting rooms, follow verified creator picks, and sweat
            every live leg together
          </Text>

          {/* Search Input Bar */}
          <View className="mb-4 flex-row items-center rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2.5">
            <Ionicons name="search" size={16} color="#71717a" />
            <TextInput
              placeholder="Search communities by name, sport, or creator..."
              placeholderTextColor="#71717a"
              className="ml-2.5 flex-1 text-xs text-white"
              value={searchDirectory}
              onChangeText={setSearchDirectory}
              style={{ fontSize: 16 }}
            />
            {searchDirectory.length > 0 && (
              <HapticPressable onPress={() => setSearchDirectory("")}>
                <Ionicons name="close-circle" size={16} color="#71717a" />
              </HapticPressable>
            )}
          </View>

          {/* Category Chips */}
          <View className="mb-5">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6 }}
            >
              {[
                "All",
                "NBA",
                "NFL",
                "CBB & NBA",
                "MLB",
                "NHL",
                "Soccer",
                "Multi-Sport",
                "High Rollers",
              ].map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <HapticPressable
                    key={cat}
                    className={`rounded-full px-3.5 py-1.5 ${
                      active ? "bg-zinc-800" : "bg-transparent"
                    }`}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedCategory(cat);
                    }}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        active ? "text-white" : "text-zinc-500"
                      }`}
                    >
                      {cat}
                    </Text>
                  </HapticPressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Section 1: My Joined Communities (Horizontal Scrolling Cards as requested!) */}
          <View className="mb-6">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
                MY JOINED ROOMS ({joinedCommunities.length})
              </Text>
              <Text className="text-[10px] text-zinc-500">
                Swipe horizontally
              </Text>
            </View>

            {joinedCommunities.length === 0 ? (
              <View className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 items-center justify-center">
                <Text className="text-xs text-zinc-400">
                  No joined rooms matching filter.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingRight: 4 }}
              >
                {joinedCommunities.map((comm) => (
                  <HapticPressable
                    key={comm.id}
                    style={{ width: 235 }}
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      ).catch(() => {});
                      setActiveCommunityId(comm.id);
                    }}
                  >
                    <GlassCard
                      className="p-3.5 h-[155px] justify-between"
                      variant="accent"
                    >
                      <View>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2.5">
                            <View className="size-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                              <Text className="font-mono text-xs font-black text-emerald-400">
                                {comm.avatar}
                              </Text>
                            </View>
                            <View className="flex-1">
                              <Text
                                className="text-sm font-bold text-white"
                                numberOfLines={1}
                              >
                                {comm.name}
                              </Text>
                              <Text
                                className="text-[10px] text-zinc-400"
                                numberOfLines={1}
                              >
                                by @{comm.creator} · {comm.sport}
                              </Text>
                            </View>
                          </View>

                          {Boolean(comm.unreadCount) && (
                            <View className="size-4 items-center justify-center rounded-full bg-emerald-500">
                              <Text className="text-[9px] font-bold text-zinc-950">
                                {comm.unreadCount}
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text
                          className="mt-2 text-[11px] leading-tight text-zinc-300"
                          numberOfLines={2}
                        >
                          {comm.description}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between border-t border-zinc-800/80 pt-2">
                        <View className="flex-row items-center gap-1.5">
                          <View className="size-1.5 rounded-full bg-emerald-400" />
                          <Text className="text-[10px] text-zinc-400">
                            {comm.onlineCount} online
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-0.5">
                          <Text className="text-[11px] font-bold text-emerald-400">
                            Open
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={11}
                            color="#34d399"
                          />
                        </View>
                      </View>
                    </GlassCard>
                  </HapticPressable>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Section: Discover Top Bettor Profiles (Instagram-Style Profiles) */}
          <View className="mb-6">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="sparkles" size={13} color="#34d399" />
                <Text className="text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
                  TOP BETTOR PROFILES ({TOP_BETTORS_DIRECTORY.length})
                </Text>
              </View>
              <Text className="text-[10px] text-zinc-500">
                Tap card to view grid
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 4 }}
            >
              {TOP_BETTORS_DIRECTORY.map((bettor) => (
                <HapticPressable
                  key={bettor.id}
                  style={{ width: 175 }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setSelectedBettorProfile(bettor);
                  }}
                >
                  <GlassCard className="p-3.5 h-[175px] justify-between items-center text-center">
                    <View className="items-center">
                      <View className="relative size-14 items-center justify-center rounded-full border-2 border-emerald-400 bg-zinc-900 p-0.5 shadow-sm shadow-emerald-500/20">
                        <View className="size-full items-center justify-center rounded-full bg-zinc-900">
                          <Text className="font-mono text-sm font-black text-emerald-400">
                            {bettor.avatar}
                          </Text>
                        </View>
                        <View className="absolute -right-0.5 -bottom-0.5 size-4 items-center justify-center rounded-full border border-zinc-950 bg-emerald-500">
                          <Ionicons name="checkmark" size={9} color="#09090b" />
                        </View>
                      </View>

                      <Text
                        className="mt-2 text-xs font-bold text-white text-center"
                        numberOfLines={1}
                      >
                        {bettor.name}
                      </Text>
                      <Text
                        className="text-[10px] font-mono text-zinc-400 text-center"
                        numberOfLines={1}
                      >
                        @{bettor.handle}
                      </Text>
                      <Text className="mt-1 text-[10px] font-semibold text-emerald-400 text-center">
                        {bettor.hitRate} Hit Rate · {bettor.followersCount}
                      </Text>
                    </View>

                    <View className="w-full rounded-lg bg-emerald-500/20 border border-emerald-500/30 py-1.5 items-center">
                      <Text className="text-[10px] font-bold text-emerald-400">
                        View Profile
                      </Text>
                    </View>
                  </GlassCard>
                </HapticPressable>
              ))}
            </ScrollView>
          </View>

          {/* Section 2: Discover Communities (Toggleable 2-Column Grid as requested!) */}
          <View className="mb-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                DISCOVER COMMUNITIES ({discoverCommunities.length})
              </Text>

              {/* View Toggle: 2-Column Grid vs List */}
              <View className="flex-row items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-0.5">
                <HapticPressable
                  accessibilityLabel="2-column grid view"
                  className={`rounded-md p-1 ${
                    isDiscoverGridView ? "bg-zinc-800" : "bg-transparent"
                  }`}
                  onPress={() => setIsDiscoverGridView(true)}
                >
                  <Ionicons
                    name="grid-outline"
                    size={13}
                    color={isDiscoverGridView ? "#34d399" : "#71717a"}
                  />
                </HapticPressable>
                <HapticPressable
                  accessibilityLabel="List view"
                  className={`rounded-md p-1 ${
                    !isDiscoverGridView ? "bg-zinc-800" : "bg-transparent"
                  }`}
                  onPress={() => setIsDiscoverGridView(false)}
                >
                  <Ionicons
                    name="list-outline"
                    size={13}
                    color={!isDiscoverGridView ? "#34d399" : "#71717a"}
                  />
                </HapticPressable>
              </View>
            </View>

            {discoverCommunities.length === 0 ? (
              <View className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 items-center justify-center">
                <Text className="text-xs text-zinc-400">
                  No communities found matching search.
                </Text>
              </View>
            ) : isDiscoverGridView ? (
              /* 2-COLUMN GRID VIEW */
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {discoverCommunities.map((comm) => (
                  <View key={comm.id} style={{ width: "48.5%" }}>
                    <GlassCard className="p-3 h-[180px] justify-between">
                      <View>
                        <View className="flex-row items-start justify-between">
                          <View className="size-8 items-center justify-center rounded-xl bg-zinc-800">
                            <Text className="font-mono text-xs font-black text-zinc-200">
                              {comm.avatar}
                            </Text>
                          </View>
                          <HapticPressable
                            className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-1"
                            onPress={() => handleJoinCommunity(comm.id)}
                          >
                            <Text className="text-[10px] font-bold text-emerald-400">
                              Join
                            </Text>
                          </HapticPressable>
                        </View>

                        <Text
                          className="mt-2 text-xs font-bold text-white"
                          numberOfLines={1}
                        >
                          {comm.name}
                        </Text>
                        <Text
                          className="text-[10px] text-zinc-400"
                          numberOfLines={1}
                        >
                          by @{comm.creator} · {comm.sport}
                        </Text>

                        <Text
                          className="mt-1.5 text-[10px] text-zinc-400 leading-tight"
                          numberOfLines={2}
                        >
                          {comm.description}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between border-t border-zinc-800/60 pt-1.5">
                        <Text className="text-[9px] text-zinc-500">
                          {comm.memberCount.toLocaleString()} members
                        </Text>
                        {comm.price && (
                          <Text className="text-[9px] font-semibold text-zinc-300">
                            {comm.price}
                          </Text>
                        )}
                      </View>
                    </GlassCard>
                  </View>
                ))}
              </View>
            ) : (
              /* COMPACT LIST VIEW */
              <View className="gap-3">
                {discoverCommunities.map((comm) => (
                  <GlassCard key={comm.id} className="p-4">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-center gap-3">
                        <View className="size-11 items-center justify-center rounded-2xl bg-zinc-800">
                          <Text className="font-mono text-sm font-black text-zinc-200">
                            {comm.avatar}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-base font-bold text-white">
                            {comm.name}
                          </Text>
                          <Text className="text-[11px] text-zinc-400">
                            by @{comm.creator} · {comm.sport}
                          </Text>
                        </View>
                      </View>

                      <HapticPressable
                        className="rounded-xl bg-zinc-800 px-3.5 py-1.5"
                        onPress={() => handleJoinCommunity(comm.id)}
                      >
                        <Text className="text-xs font-bold text-white">Join</Text>
                      </HapticPressable>
                    </View>

                    <Text className="mt-2.5 text-xs leading-relaxed text-zinc-400">
                      {comm.description}
                    </Text>

                    <View className="mt-3 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Ionicons
                          name="people-outline"
                          size={13}
                          color="#71717a"
                        />
                        <Text className="text-[11px] text-zinc-500">
                          {comm.memberCount.toLocaleString()} members
                        </Text>
                      </View>
                      {comm.price && (
                        <Text className="text-[10px] font-semibold text-emerald-400">
                          {comm.price}
                        </Text>
                      )}
                    </View>
                  </GlassCard>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* CREATE NEW COMMUNITY MODAL (Enhanced with Free vs Paid, Channel Presets, & Notifications) */}
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsCreateModalOpen(false)}
          visible={isCreateModalOpen}
        >
          <SafeAreaView
            className="flex-1 bg-zinc-950"
            style={{ backgroundColor: "#09090b", flex: 1 }}
          >
            <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
              <View>
                <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                  CREATOR PLATFORM
                </Text>
                <Text className="text-base font-bold text-white">
                  Create New Community
                </Text>
              </View>
              <HapticPressable
                accessibilityLabel="Close create community modal"
                className="size-8 items-center justify-center rounded-full bg-zinc-800"
                onPress={() => setIsCreateModalOpen(false)}
              >
                <Ionicons name="close" size={18} color="#d4d4d8" />
              </HapticPressable>
            </View>

            <ScrollView className="flex-1 px-4 py-4">
              <View className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="sparkles" size={16} color="#34d399" />
                  <Text className="text-sm font-bold text-white">
                    Creator Syndicate Studio
                  </Text>
                </View>
                <Text className="mt-1 text-xs text-zinc-300">
                  Launch your private syndicate, configure custom channel
                  presets, set membership rules, and push instant bet slip
                  alerts.
                </Text>
              </View>

              <View className="space-y-4">
                {/* 1. Basic Details */}
                <View>
                  <Text className="text-xs font-semibold text-zinc-300">
                    Community Name
                  </Text>
                  <TextInput
                    className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                    placeholder="e.g. Sharp Parlays Club"
                    placeholderTextColor="#71717a"
                    value={createName}
                    onChangeText={setCreateName}
                    style={{ fontSize: 16 }}
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-zinc-300">
                    URL Handle (Slug)
                  </Text>
                  <TextInput
                    className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                    placeholder="e.g. sharp-parlays"
                    placeholderTextColor="#71717a"
                    value={createSlug}
                    onChangeText={setCreateSlug}
                    style={{ fontSize: 16 }}
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-zinc-300">
                    Description
                  </Text>
                  <TextInput
                    className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                    placeholder="What focus or angle does your syndicate specialize in?"
                    placeholderTextColor="#71717a"
                    multiline
                    numberOfLines={2}
                    value={createDesc}
                    onChangeText={setCreateDesc}
                    style={{ fontSize: 16 }}
                  />
                </View>

                {/* 2. Sport / Focus Category */}
                <View>
                  <Text className="text-xs font-semibold text-zinc-300">
                    Primary Sport
                  </Text>
                  <View className="mt-1.5 flex-row flex-wrap gap-2">
                    {["NBA", "NFL", "MLB", "NHL", "Soccer", "Multi-Sport"].map(
                      (sp) => (
                        <HapticPressable
                          key={sp}
                          className={`rounded-xl border px-3 py-1.5 ${
                            createSport === sp
                              ? "border-emerald-500 bg-emerald-500/20"
                              : "border-zinc-800 bg-zinc-900"
                          }`}
                          onPress={() => setCreateSport(sp)}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              createSport === sp
                                ? "text-emerald-400"
                                : "text-zinc-400"
                            }`}
                          >
                            {sp}
                          </Text>
                        </HapticPressable>
                      )
                    )}
                  </View>
                </View>

                {/* 3. Membership Access: Free vs Paid */}
                <View>
                  <Text className="text-xs font-semibold text-zinc-300">
                    Membership Access
                  </Text>
                  <View className="mt-1.5 flex-row gap-2.5">
                    <HapticPressable
                      className={`flex-1 rounded-xl border p-3 ${
                        createAccessType === "free"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900"
                      }`}
                      onPress={() => setCreateAccessType("free")}
                    >
                      <Text className="text-xs font-bold text-white">
                        Free Public Hub
                      </Text>
                      <Text className="mt-0.5 text-[10px] text-zinc-400">
                        Open to all verified bettors
                      </Text>
                    </HapticPressable>

                    <HapticPressable
                      className={`flex-1 rounded-xl border p-3 ${
                        createAccessType === "paid"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900"
                      }`}
                      onPress={() => setCreateAccessType("paid")}
                    >
                      <Text className="text-xs font-bold text-white">
                        Paid VIP Pass
                      </Text>
                      <Text className="mt-0.5 text-[10px] text-zinc-400">
                        Exclusive syndicate tier
                      </Text>
                    </HapticPressable>
                  </View>

                  {/* If Paid: Price choices */}
                  {createAccessType === "paid" && (
                    <View className="mt-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                      <Text className="text-[10px] font-bold text-zinc-400 uppercase">
                        MONTHLY MEMBERSHIP TIER
                      </Text>
                      <View className="mt-2 flex-row gap-2">
                        {["14.99 / mo", "19.99 / mo", "29.99 / mo", "49.99 / mo"].map(
                          (price) => (
                            <HapticPressable
                              key={price}
                              className={`flex-1 items-center rounded-lg border py-2 ${
                                createPrice === price
                                  ? "border-emerald-500 bg-emerald-500/20"
                                  : "border-zinc-800 bg-zinc-900"
                              }`}
                              onPress={() => setCreatePrice(price)}
                            >
                              <Text
                                className={`text-[10px] font-bold ${
                                  createPrice === price
                                    ? "text-emerald-400"
                                    : "text-zinc-400"
                                }`}
                              >
                                {price}
                              </Text>
                            </HapticPressable>
                          )
                        )}
                      </View>
                    </View>
                  )}
                </View>

                {/* 4. Channel Presets */}
                <View>
                  <Text className="text-xs font-semibold text-zinc-300">
                    Channel Structure Presets
                  </Text>
                  <View className="mt-1.5 gap-2">
                    <HapticPressable
                      className={`rounded-xl border p-3 ${
                        createChannelPreset === "standard"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900"
                      }`}
                      onPress={() => setCreateChannelPreset("standard")}
                    >
                      <Text className="text-xs font-bold text-white">
                        Standard Sports Hub
                      </Text>
                      <Text className="mt-0.5 text-[10px] text-zinc-400">
                        #announcements, #general-chat, #live-sweats, #bet-slips
                      </Text>
                    </HapticPressable>

                    <HapticPressable
                      className={`rounded-xl border p-3 ${
                        createChannelPreset === "vip"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900"
                      }`}
                      onPress={() => setCreateChannelPreset("vip")}
                    >
                      <Text className="text-xs font-bold text-white">
                        VIP Syndicate Preset
                      </Text>
                      <Text className="mt-0.5 text-[10px] text-zinc-400">
                        #creator-picks, #model-projections, #whale-lounge,
                        #slip-discussion
                      </Text>
                    </HapticPressable>

                    <HapticPressable
                      className={`rounded-xl border p-3 ${
                        createChannelPreset === "custom"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-900"
                      }`}
                      onPress={() => setCreateChannelPreset("custom")}
                    >
                      <Text className="text-xs font-bold text-white">
                        Custom Channels
                      </Text>
                      <Text className="mt-0.5 text-[10px] text-zinc-400">
                        Define custom channel names
                      </Text>
                    </HapticPressable>
                  </View>

                  {createChannelPreset === "custom" && (
                    <TextInput
                      className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white"
                      placeholder="e.g. #nba-locks, #injury-news, #recap"
                      placeholderTextColor="#71717a"
                      value={createCustomChannels}
                      onChangeText={setCreateCustomChannels}
                      style={{ fontSize: 16 }}
                    />
                  )}
                </View>

                {/* 5. Notification Rules */}
                <View>
                  <Text className="text-xs font-semibold text-zinc-300">
                    Room Notification Rules
                  </Text>
                  <View className="mt-1.5 gap-2">
                    {[
                      {
                        desc: "Members get push alerts only when verified bet slips are pinned",
                        id: "slips_only",
                        label: "Verified Slip Alerts Only (Recommended)",
                      },
                      {
                        desc: "Push alerts for all room discussions and live sweat messages",
                        id: "all",
                        label: "All Messages & Sweats",
                      },
                      {
                        desc: "Only notify members when they are @mentioned or replied to",
                        id: "mentions_only",
                        label: "Mentions & Direct Replies",
                      },
                    ].map((rule) => (
                      <HapticPressable
                        key={rule.id}
                        className={`rounded-xl border p-2.5 ${
                          createNotifyRule === rule.id
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-zinc-800 bg-zinc-900"
                        }`}
                        onPress={() =>
                          setCreateNotifyRule(
                            rule.id as "slips_only" | "all" | "mentions_only"
                          )
                        }
                      >
                        <Text className="text-xs font-bold text-white">
                          {rule.label}
                        </Text>
                        <Text className="mt-0.5 text-[10px] text-zinc-400">
                          {rule.desc}
                        </Text>
                      </HapticPressable>
                    ))}
                  </View>
                </View>

                {createError ? (
                  <View className="mt-4 flex-row items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
                    <Ionicons name="alert-circle" size={14} color="#fb7185" />
                    <Text className="flex-1 text-xs text-rose-400">
                      {createError}
                    </Text>
                  </View>
                ) : null}

                <HapticPressable
                  className="mt-4 mb-6 items-center rounded-xl bg-emerald-500 py-3.5 shadow-lg shadow-emerald-500/25"
                  onPress={handleLaunchCommunity}
                >
                  <Text className="text-xs font-bold text-zinc-950">
                    Launch Community
                  </Text>
                </HapticPressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* INSTAGRAM-STYLE PUBLIC BETTOR PROFILE MODAL IN DISCOVERY */}
        <BettorProfileModal
          bettor={selectedBettorProfile}
          visible={selectedBettorProfile !== null}
          onClose={() => setSelectedBettorProfile(null)}
          onJoinCommunity={(hubId) => {
            setSelectedBettorProfile(null);
            setActiveCommunityId(hubId);
          }}
          onEnterHub={(hubId) => {
            setSelectedBettorProfile(null);
            setActiveCommunityId(hubId);
          }}
          onMessage={(b) => {
            setSelectedBettorProfile(null);
            setActiveCommunityId(b.syndicateHub?.id ?? "sharp-edge");
          }}
        />
      </SafeAreaView>
    );
  }

  // ==========================================
  // VIEW 2: ACTIVE COMMUNITY CHAT ROOM (ID VIEW)
  // (Notice: NO + Create Community button here!)
  // ==========================================
  const isComposerExpanded =
    isComposerFocused ||
    inputText.length > 0 ||
    Boolean(attachedSlip) ||
    Boolean(attachedPhoto);

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-zinc-950"
      style={{ backgroundColor: "#09090b", flex: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        {/* Top Header: Back Button, Room Title & Actions (Rules & Members) */}
        <View className="border-b border-zinc-800/80 px-4 pt-2 pb-3">
          <View className="flex-row items-center justify-between">
            {/* Back to Hubs Icon Button */}
            <HapticPressable
              accessibilityLabel="Back to directory"
              className="size-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"
              onPress={() => setActiveCommunityId(null)}
            >
              <Ionicons name="chevron-back" size={18} color="#e4e4e7" />
            </HapticPressable>

            {/* Room Title with Ellipsize & Live Count */}
            <View className="flex-1 mx-2.5">
              <Text
                className="text-sm font-black tracking-tight text-white"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {activeCommunity.name}
              </Text>
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <View className="size-1.5 rounded-full bg-emerald-400" />
                <Text className="text-[10px] text-zinc-400" numberOfLines={1}>
                  {activeCommunity.onlineCount} online ·{" "}
                  {activeCommunity.memberCount.toLocaleString()} members
                </Text>
              </View>
            </View>

            {/* Room Actions: Rules & Members (Compact Icons) */}
            <View className="flex-row items-center gap-1.5">
              <HapticPressable
                accessibilityLabel="View community rules"
                className="size-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"
                onPress={() => setIsRulesModalOpen(true)}
              >
                <Ionicons
                  name="document-text-outline"
                  size={15}
                  color="#34d399"
                />
              </HapticPressable>

              <HapticPressable
                accessibilityLabel="View members"
                className="size-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"
                onPress={() => setIsMembersModalOpen(true)}
              >
                <Ionicons name="people-outline" size={15} color="#a1a1aa" />
              </HapticPressable>
            </View>
          </View>

          {/* Channel Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{ gap: 6 }}
          >
            {channels.map((channel) => {
              const active = activeChannelId === channel.id;
              return (
                <HapticPressable
                  key={channel.id}
                  style={{ flexShrink: 0 }}
                  className={`flex-row items-center gap-1 rounded-full px-3.5 py-1.5 border ${
                    active
                      ? "border-emerald-500/50 bg-emerald-500/20"
                      : "border-zinc-800 bg-zinc-900/60"
                  }`}
                  onPress={() => handleChannelSelect(channel.id)}
                >
                  <Text
                    className={`font-mono text-xs ${
                      active ? "font-bold text-emerald-400" : "text-zinc-500"
                    }`}
                  >
                    #
                  </Text>
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-zinc-400"
                    }`}
                  >
                    {channel.name}
                  </Text>
                  {Boolean(channel.unreadCount) && (
                    <View className="ml-1 size-4 items-center justify-center rounded-full bg-emerald-500">
                      <Text className="text-[9px] font-bold text-zinc-950">
                        {channel.unreadCount}
                      </Text>
                    </View>
                  )}
                </HapticPressable>
              );
            })}
          </ScrollView>
        </View>

        {/* New Messages Pill (Slack style) — only when live messages actually arrived while scrolled up */}
        {unreadCount > 0 && (
          <View className="items-center py-2 bg-transparent">
            <HapticPressable
              accessibilityLabel="Jump to new messages"
              className="flex-row items-center gap-1.5 rounded-full bg-cyan-600/90 px-3.5 py-1 shadow-md shadow-cyan-600/30"
              onPress={handleJumpToUnread}
            >
              <Ionicons name="arrow-down" size={12} color="#ffffff" />
              <Text className="text-xs font-bold text-white">
                {unreadCount === 1
                  ? "1 new message"
                  : `${unreadCount} new messages`}
              </Text>
            </HapticPressable>
          </View>
        )}

        {/* Chat Feed */}
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{
            paddingBottom: 20,
            paddingTop: 8,
          }}
          onScroll={handleChatScroll}
          ref={chatScrollRef}
          scrollEventThrottle={64}
          showsVerticalScrollIndicator={false}
        >
          {/* Cursor-paginated history: only rendered when older pages exist */}
          {cursorByChannel[activeChannelId] ? (
            <HapticPressable
              accessibilityLabel="Load earlier messages"
              className="mb-3 self-center rounded-full border border-zinc-800 bg-zinc-900/80 px-3.5 py-1.5"
              disabled={loadingOlder}
              onPress={handleLoadOlder}
            >
              <Text className="text-[10px] font-bold text-zinc-300">
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </Text>
            </HapticPressable>
          ) : null}
          {/* Pinned Creator Slip Card */}
          {pinnedSlip && (
            <GlassCard className="mb-4 p-3.5" variant="accent">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="pin" size={13} color="#34d399" />
                  <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                    PINNED PICK · @{pinnedSlip.creator}
                  </Text>
                </View>
                <View className="rounded bg-emerald-500/20 px-1.5 py-0.5">
                  <Text className="font-mono text-[10px] font-bold text-emerald-400">
                    Live Sweat
                  </Text>
                </View>
              </View>

              <Text className="mt-1 text-xs font-bold text-white">
                {pinnedSlip.title}
              </Text>

              {/* Legs summary */}
              <View className="mt-2 space-y-1">
                {pinnedSlip.legs.map((leg, i) => (
                  <View
                    key={`pinned_${i}`}
                    className="flex-row items-center justify-between text-xs"
                  >
                    <Text className="text-[11px] text-zinc-300">
                      • {leg.subject}: {leg.line}
                    </Text>
                    <Text
                      className={`font-mono text-[10px] font-bold uppercase ${
                        leg.status === "won"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {leg.status}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="mt-3 flex-row items-center justify-between border-t border-zinc-800/80 pt-2">
                <Text className="text-[10px] text-zinc-400">
                  Verified via Official Sports Feeds
                </Text>
                <HapticPressable
                  className={`rounded-lg px-2.5 py-1 ${
                    followedPick ? "bg-zinc-800" : "bg-emerald-500"
                  }`}
                  onPress={async () => {
                    await Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    );
                    setFollowedPick(!followedPick);
                  }}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      followedPick ? "text-emerald-400" : "text-zinc-950"
                    }`}
                  >
                    {followedPick ? "Following ✓" : "Follow Pick"}
                  </Text>
                </HapticPressable>
              </View>
            </GlassCard>
          )}

          {/* Slack-Style Messages Stream */}
          {chatMessages.map((msg) => (
            <View key={msg.id} className="mb-4">
              <View className="flex-row items-start gap-3">
                {/* Slack Rounded Square Avatar (Tap to view Bettor Profile) */}
                <HapticPressable
                  accessibilityLabel={`View profile of ${msg.authorName}`}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setSelectedBettorProfile(
                      getBettorProfile(msg.authorHandle || msg.authorName)
                    );
                  }}
                  className={`size-10 items-center justify-center rounded-xl border ${
                    msg.isCreator || msg.roleBadge === "CREATOR"
                      ? "border-emerald-500/40 bg-emerald-500/15"
                      : msg.roleBadge === "AGENT"
                        ? "border-cyan-500/30 bg-cyan-950/40"
                        : msg.roleBadge === "VIP"
                          ? "border-purple-500/30 bg-purple-950/40"
                          : "border-zinc-800 bg-zinc-800"
                  }`}
                >
                  <Text
                    className={`font-mono text-xs font-bold ${
                      msg.isCreator || msg.roleBadge === "CREATOR"
                        ? "text-emerald-400"
                        : msg.roleBadge === "AGENT"
                          ? "text-cyan-400"
                          : msg.roleBadge === "VIP"
                            ? "text-purple-300"
                            : "text-zinc-300"
                    }`}
                  >
                    {msg.authorName.slice(0, 2).toUpperCase()}
                  </Text>
                </HapticPressable>

                {/* Message Body & Details */}
                <View className="flex-1">
                  {/* Header row: Author + Badge + Timestamp */}
                  <View className="flex-row items-center gap-2">
                    <HapticPressable
                      accessibilityLabel={`View profile of ${msg.authorName}`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setSelectedBettorProfile(
                          getBettorProfile(msg.authorHandle || msg.authorName)
                        );
                      }}
                    >
                      <Text className="text-sm font-bold text-white">
                        {msg.authorName}
                      </Text>
                    </HapticPressable>
                    {(msg.roleBadge || msg.isCreator) && (
                      <View
                        className={`rounded px-1.5 py-0.2 ${
                          msg.isCreator || msg.roleBadge === "CREATOR"
                            ? "bg-emerald-500/20"
                            : msg.roleBadge === "AGENT"
                              ? "bg-zinc-800 border border-zinc-700/60"
                              : "bg-purple-500/20"
                        }`}
                      >
                        <Text
                          className={`font-mono text-[9px] font-bold uppercase ${
                            msg.isCreator || msg.roleBadge === "CREATOR"
                              ? "text-emerald-400"
                              : msg.roleBadge === "AGENT"
                                ? "text-zinc-300"
                                : "text-purple-300"
                          }`}
                        >
                          {msg.roleBadge ?? (msg.isCreator ? "CREATOR" : "")}
                        </Text>
                      </View>
                    )}
                    <Text className="text-[11px] text-zinc-500">
                      {msg.timestamp}
                    </Text>
                  </View>

                  {/* Message Content */}
                  <Text className="mt-1 text-sm leading-relaxed text-zinc-200">
                    {msg.content}
                  </Text>

                  {/* Rich Ticket Attachment Card */}
                  {msg.ticketAttachment && (
                    <HapticPressable
                      className="mt-2.5 rounded-xl border border-zinc-800 bg-zinc-900/90 p-3"
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        const found = userTickets.find(
                          (t) => t.id === msg.ticketAttachment?.id
                        );
                        if (found) {
                          setSelectedTicket(found);
                        } else if (userTickets[0]) {
                          setSelectedTicket(userTickets[0]);
                        }
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2">
                          <View className="size-6 items-center justify-center rounded-lg bg-emerald-500/10">
                            <Ionicons
                              name="receipt-outline"
                              size={14}
                              color="#34d399"
                            />
                          </View>
                          <Text className="text-xs font-bold text-white">
                            {msg.ticketAttachment.summary}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={13}
                          color="#71717a"
                        />
                      </View>
                      <View className="mt-2 flex-row items-center justify-between border-t border-zinc-800/60 pt-2">
                        <Text className="text-[10px] text-zinc-400">
                          {msg.ticketAttachment.legsCount} Legs · Verified Slip
                        </Text>
                        <Text className="text-[10px] font-semibold text-emerald-400">
                          Inspect Slip ID →
                        </Text>
                      </View>
                    </HapticPressable>
                  )}

                  {/* Reaction Chips & Reply Action */}
                  <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                    {msg.reactions.map((r, i) => (
                      <HapticPressable
                        key={`r_${i}`}
                        className={`flex-row items-center gap-1 rounded-full border px-2 py-0.5 ${
                          r.mine
                            ? "border-emerald-500/60 bg-emerald-500/10"
                            : "border-zinc-800 bg-zinc-900"
                        }`}
                        onPress={() => handleReactionPress(msg.id, r.emoji)}
                      >
                        <Text className="text-xs">{r.emoji}</Text>
                        <Text className="font-mono text-[10px] text-zinc-400">
                          {r.count}
                        </Text>
                      </HapticPressable>
                    ))}
                    <HapticPressable
                      accessibilityLabel="Add reaction"
                      className="items-center justify-center rounded-full border border-dashed border-zinc-700 bg-zinc-900 px-2 py-0.5"
                      onPress={() => handleReactionPress(msg.id, "🔥")}
                    >
                      <Ionicons name="add" size={12} color="#a1a1aa" />
                    </HapticPressable>

                    {/* Slack Reply Button */}
                    <HapticPressable
                      accessibilityLabel={`Reply to ${msg.authorName}`}
                      className="flex-row items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-0.5"
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setActiveThreadMessage(msg);
                        setReplyingToUser(msg.authorName);
                        setThreadInputText(`@${msg.authorName} `);
                      }}
                    >
                      <Ionicons
                        name="arrow-undo-outline"
                        size={11}
                        color="#34d399"
                      />
                      <Text className="text-[10px] font-medium text-emerald-400">
                        Reply
                      </Text>
                    </HapticPressable>
                  </View>

                  {/* Thread Button (Slack Signature!) */}
                  {Boolean(msg.repliesCount || msg.replies?.length) && (
                    <HapticPressable
                      className="mt-2.5 flex-row items-center gap-2 rounded-xl border border-zinc-800/60 bg-zinc-900/80 px-2.5 py-1.5"
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setActiveThreadMessage(msg);
                      }}
                    >
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={13}
                        color="#34d399"
                      />
                      <Text className="text-xs font-semibold text-emerald-400">
                        {msg.repliesCount ?? msg.replies?.length ?? 0} replies
                      </Text>
                      <Text className="text-[10px] text-zinc-500">
                        Last reply {msg.lastReplyTime ?? "recently"}
                      </Text>
                      <View className="flex-1" />
                      <Ionicons
                        name="chevron-forward"
                        size={12}
                        color="#71717a"
                      />
                    </HapticPressable>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Slack-Style Message Composer with Dynamic Expansion & Tight Liquid Glass Spacing */}
        <View
          className="border-t border-zinc-800/80 bg-zinc-950 px-4 pt-2"
          style={{
            paddingBottom: isKeyboardVisible
              ? Platform.OS === "ios"
                ? 6
                : 4
              : Platform.OS === "ios"
                ? 108
                : 12,
          }}
        >
          {isComposerExpanded ? (
            /* Expanded Rich Composer (Active / Typing) */
            <View className="rounded-2xl border border-zinc-800 bg-zinc-900/95 p-3">
              {/* Attached Bet Slip Thumbnail Preview */}
              {attachedSlip && (
                <View className="mb-2 flex-row items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <View className="flex-1 flex-row items-center gap-2 pr-2">
                    <Ionicons
                      name="receipt-outline"
                      size={16}
                      color="#34d399"
                    />
                    <View className="flex-1">
                      <Text
                        className="text-xs font-bold text-white"
                        numberOfLines={1}
                      >
                        {attachedSlip.sourceName} · {attachedSlip.sportsEvent}
                      </Text>
                      <Text className="text-[10px] text-emerald-400">
                        {attachedSlip.legs?.length ?? 0} Legs attached
                      </Text>
                    </View>
                  </View>
                  <HapticPressable
                    accessibilityLabel="Remove attached slip"
                    className="size-6 items-center justify-center rounded-full bg-zinc-800"
                    onPress={() => setAttachedSlip(null)}
                  >
                    <Ionicons name="close" size={14} color="#d4d4d8" />
                  </HapticPressable>
                </View>
              )}

              {/* Attached Photo Preview */}
              {attachedPhoto && (
                <View className="mb-2 flex-row items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                  <View className="flex-1 flex-row items-center gap-2 pr-2">
                    <Ionicons name="image-outline" size={16} color="#38bdf8" />
                    <View className="flex-1">
                      <Text
                        className="text-xs font-bold text-white"
                        numberOfLines={1}
                      >
                        {attachedPhoto}
                      </Text>
                      <Text className="text-[10px] text-cyan-400">
                        Image ready to send
                      </Text>
                    </View>
                  </View>
                  <HapticPressable
                    accessibilityLabel="Remove photo"
                    className="size-6 items-center justify-center rounded-full bg-zinc-800"
                    onPress={() => setAttachedPhoto(null)}
                  >
                    <Ionicons name="close" size={14} color="#d4d4d8" />
                  </HapticPressable>
                </View>
              )}

              {/* Main Multiline TextInput with autoFocus & ref */}
              <TextInput
                ref={composerInputRef}
                autoFocus
                className="min-h-[44px] max-h-[120px] text-sm text-white"
                placeholder={`Message #${activeChannelId}...`}
                placeholderTextColor="#71717a"
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => setIsComposerFocused(true)}
                onBlur={() => {
                  if (!inputText.trim() && !attachedSlip && !attachedPhoto) {
                    setIsComposerFocused(false);
                  }
                }}
                multiline
                style={{ fontSize: 15 }}
              />

              {/* Bottom Action Bar inside Composer */}
              <View className="mt-2.5 flex-row items-center justify-between border-t border-zinc-800/50 pt-2">
                <View className="flex-row items-center gap-1.5">
                  {/* (+) Button opens Slack Attachment Menu */}
                  <HapticPressable
                    accessibilityLabel="Add attachment"
                    className="size-7 items-center justify-center rounded-full bg-zinc-800"
                    onPress={() => setIsSlackAttachmentMenuOpen(true)}
                  >
                    <Ionicons name="add" size={16} color="#d4d4d8" />
                  </HapticPressable>

                  {/* Format Aa button */}
                  <HapticPressable
                    accessibilityLabel="Text format"
                    className="size-7 items-center justify-center rounded-full bg-zinc-800/60"
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                    }}
                  >
                    <Text className="font-mono text-xs font-bold text-zinc-400">
                      Aa
                    </Text>
                  </HapticPressable>

                  {/* Quick Emoji 😊 opens Categorized Picker */}
                  <HapticPressable
                    accessibilityLabel="Add emoji"
                    className="size-7 items-center justify-center rounded-full bg-zinc-800/60"
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setIsEmojiPickerOpen(true);
                    }}
                  >
                    <Ionicons name="happy-outline" size={15} color="#a1a1aa" />
                  </HapticPressable>

                  {/* Mention @ button */}
                  <HapticPressable
                    accessibilityLabel="Mention user"
                    className="size-7 items-center justify-center rounded-full bg-zinc-800/60"
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setInputText((prev) => `${prev}@`);
                    }}
                  >
                    <Ionicons name="at" size={15} color="#a1a1aa" />
                  </HapticPressable>

                  {/* Slip Receipt icon */}
                  <HapticPressable
                    accessibilityLabel="Attach slip"
                    className="size-7 items-center justify-center rounded-full bg-zinc-800/60"
                    onPress={() => setIsShareSlipPickerOpen(true)}
                  >
                    <Ionicons
                      name="receipt-outline"
                      size={14}
                      color="#34d399"
                    />
                  </HapticPressable>
                </View>

                {/* Send and Collapse Controls */}
                <View className="flex-row items-center gap-2">
                  {!inputText.trim() && !attachedSlip && !attachedPhoto && (
                    <HapticPressable
                      accessibilityLabel="Collapse composer"
                      className="size-7 items-center justify-center rounded-full bg-zinc-800/80"
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setIsComposerFocused(false);
                        composerInputRef.current?.blur();
                        Keyboard.dismiss();
                      }}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color="#a1a1aa"
                      />
                    </HapticPressable>
                  )}

                  <HapticPressable
                    accessibilityLabel="Send message"
                    disabled={!inputText.trim() && !attachedSlip && !attachedPhoto}
                    className={`size-8 items-center justify-center rounded-full ${
                      inputText.trim() || attachedSlip || attachedPhoto
                        ? "bg-emerald-500 shadow-sm shadow-emerald-500/30"
                        : "bg-zinc-800 opacity-50"
                    }`}
                    onPress={() => handleSendMessage()}
                  >
                    <Ionicons
                      name="send"
                      size={14}
                      color={
                        inputText.trim() || attachedSlip || attachedPhoto
                          ? "#09090b"
                          : "#71717a"
                      }
                    />
                  </HapticPressable>
                </View>
              </View>
            </View>
          ) : (
            /* Compact Composer Bar (Idle / Tap to Expand and Focus Keyboard instantly) */
            <HapticPressable
              accessibilityLabel="Tap to compose message"
              className="flex-row items-center gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/90 px-3 py-2"
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsComposerFocused(true);
                setTimeout(() => composerInputRef.current?.focus(), 60);
              }}
            >
              <HapticPressable
                accessibilityLabel="Add attachment"
                className="size-7 items-center justify-center rounded-full bg-zinc-800"
                onPress={() => setIsSlackAttachmentMenuOpen(true)}
              >
                <Ionicons name="add" size={16} color="#d4d4d8" />
              </HapticPressable>

              <TextInput
                className="flex-1 text-sm text-white"
                placeholder={`Message #${activeChannelId}...`}
                placeholderTextColor="#71717a"
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsComposerFocused(true);
                  setTimeout(() => composerInputRef.current?.focus(), 60);
                }}
                style={{ fontSize: 15 }}
              />

              <HapticPressable
                accessibilityLabel="Attach slip"
                className="size-7 items-center justify-center rounded-full bg-zinc-800/70"
                onPress={() => setIsShareSlipPickerOpen(true)}
              >
                <Ionicons name="receipt-outline" size={14} color="#34d399" />
              </HapticPressable>

              <HapticPressable
                accessibilityLabel="Emoji shortcut"
                className="size-7 items-center justify-center rounded-full bg-zinc-800/70"
                onPress={() => {
                  setIsEmojiPickerOpen(true);
                }}
              >
                <Ionicons name="happy-outline" size={15} color="#a1a1aa" />
              </HapticPressable>
            </HapticPressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* MODAL 1: COMMUNITY RULES */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsRulesModalOpen(false)}
        visible={isRulesModalOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                COMMUNITY STANDARDS
              </Text>
              <Text className="text-base font-bold text-white">
                {activeCommunity.name} Rules
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close rules"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsRulesModalOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            <Text className="mb-4 text-xs text-zinc-400">
              To keep our syndicate discussions analytical, helpful, and
              transparent, all members must adhere to these community rules.
            </Text>

            <View className="gap-3">
              {COMMUNITY_RULES.map((rule, idx) => (
                <GlassCard key={idx} className="p-3.5">
                  <Text className="text-xs font-bold text-white">
                    {rule.title}
                  </Text>
                  <Text className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                    {rule.desc}
                  </Text>
                </GlassCard>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 2: COMMUNITY MEMBERS */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsMembersModalOpen(false)}
        visible={isMembersModalOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                ACTIVE ROSTER
              </Text>
              <Text className="text-base font-bold text-white">
                Members ({activeCommunity.memberCount.toLocaleString()})
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close members"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsMembersModalOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            <View className="gap-2.5">
              {communityMembers.map((member, idx) => (
                <HapticPressable
                  key={idx}
                  accessibilityLabel={`View profile of ${member.name}`}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedBettorProfile(getBettorProfile(member.handle));
                    setIsMembersModalOpen(false);
                  }}
                >
                  <GlassCard className="p-3">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-xs font-bold text-white">
                          {member.name}
                        </Text>
                        <Text className="text-[10px] text-zinc-400">
                          {member.handle}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className="rounded bg-zinc-800 px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-emerald-400">
                            {member.role}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={13}
                          color="#71717a"
                        />
                      </View>
                    </View>
                  </GlassCard>
                </HapticPressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 3: SHARE SLIP PICKER SHEET */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsShareSlipPickerOpen(false)}
        visible={isShareSlipPickerOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                SHARE BET SLIP
              </Text>
              <Text className="text-base font-bold text-white">
                Select Slip to Attach
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close slip picker"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsShareSlipPickerOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            <Text className="mb-3 text-xs text-zinc-400">
              Tap any of your tracked slips to send it into #{activeChannelId}:
            </Text>

            <View className="gap-3">
              {userTickets.map((t) => (
                <HapticPressable
                  key={t.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setAttachedSlip(t);
                    setIsShareSlipPickerOpen(false);
                  }}
                >
                  <GlassCard className="p-3.5" variant="accent">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-bold text-white">
                          {t.sourceName} · {t.ticketType}
                        </Text>
                        <Text className="mt-0.5 text-[11px] text-zinc-400">
                          {t.sportsEvent}
                        </Text>
                      </View>
                      <View className="rounded-xl bg-emerald-500 px-3 py-1.5">
                        <Text className="text-[10px] font-bold text-zinc-950">
                          Attach Slip
                        </Text>
                      </View>
                    </View>
                  </GlassCard>
                </HapticPressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 4: SLACK THREAD VIEW MODAL */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveThreadMessage(null)}
        visible={activeThreadMessage !== null}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          {/* Thread Header */}
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-base font-bold text-white">Thread</Text>
              <Text className="text-[11px] text-zinc-400">
                #{activeChannelId} · {activeCommunity.name}
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close thread"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => {
                setActiveThreadMessage(null);
                setReplyingToUser(null);
              }}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
            keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
          >
            <ScrollView
              className="flex-1 px-4 py-4"
              showsVerticalScrollIndicator={false}
            >
              {/* Parent Message Pinned */}
              {activeThreadMessage && (
                <View className="mb-4 border-b border-zinc-800/80 pb-4">
                  <View className="flex-row items-start gap-3">
                    <View className="size-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
                      <Text className="font-mono text-xs font-bold text-white">
                        {activeThreadMessage.authorName
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-bold text-white">
                          {activeThreadMessage.authorName}
                        </Text>
                        {activeThreadMessage.roleBadge && (
                          <View className="rounded border border-zinc-700/60 bg-zinc-800 px-1.5 py-0.2">
                            <Text className="font-mono text-[9px] font-bold text-zinc-300 uppercase">
                              {activeThreadMessage.roleBadge}
                            </Text>
                          </View>
                        )}
                        <Text className="text-[11px] text-zinc-500">
                          {activeThreadMessage.timestamp}
                        </Text>
                      </View>
                      <Text className="mt-1 text-sm leading-relaxed text-zinc-200">
                        {activeThreadMessage.content}
                      </Text>

                      {/* Mention author pill */}
                      <HapticPressable
                        accessibilityLabel={`Mention @${activeThreadMessage.authorName}`}
                        className="mt-2.5 flex-row items-center gap-1.5 self-start rounded-full border border-zinc-700/60 bg-zinc-800/90 px-3 py-1"
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setReplyingToUser(activeThreadMessage.authorName);
                          setThreadInputText((prev) =>
                            prev.includes(`@${activeThreadMessage.authorName}`)
                              ? prev
                              : `@${activeThreadMessage.authorName} ${prev}`
                          );
                        }}
                      >
                        <Ionicons name="at" size={13} color="#34d399" />
                        <Text className="text-xs font-semibold text-emerald-400">
                          Mention @{activeThreadMessage.authorName}
                        </Text>
                      </HapticPressable>
                    </View>
                  </View>
                </View>
              )}

              {/* Replies Counter Divider */}
              <View className="mb-3 flex-row items-center gap-2">
                <Text className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                  {activeThreadMessage?.replies?.length ?? 0} REPLIES
                </Text>
                <View className="h-[1px] flex-1 bg-zinc-800" />
              </View>

              {/* Reply Chain */}
              <View className="gap-3.5">
                {(activeThreadMessage?.replies ?? []).map((rep) => (
                  <HapticPressable
                    key={rep.id}
                    className="rounded-xl border border-transparent p-2 active:border-zinc-800 active:bg-zinc-900/60"
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setReplyingToUser(rep.authorName);
                      setThreadInputText((prev) =>
                        prev.includes(`@${rep.authorName}`)
                          ? prev
                          : `@${rep.authorName} ${prev}`
                      );
                    }}
                  >
                    <View className="flex-row items-start gap-3">
                      <View className="size-8 items-center justify-center rounded-lg border border-zinc-700/50 bg-zinc-800/80">
                        <Text className="font-mono text-[10px] font-bold text-zinc-300">
                          {rep.authorName.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-xs font-bold text-white">
                              {rep.authorName}
                            </Text>
                            {rep.roleBadge && (
                              <View className="rounded bg-zinc-800/80 px-1 py-0.2">
                                <Text className="font-mono text-[8px] font-bold text-zinc-400 uppercase">
                                  {rep.roleBadge}
                                </Text>
                              </View>
                            )}
                            <Text className="text-[10px] text-zinc-500">
                              {rep.timestamp}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1 rounded bg-zinc-800/80 px-1.5 py-0.5">
                            <Ionicons
                              name="arrow-undo-outline"
                              size={10}
                              color="#34d399"
                            />
                            <Text className="text-[10px] font-semibold text-emerald-400">
                              Reply
                            </Text>
                          </View>
                        </View>
                        <Text className="mt-1 text-xs leading-relaxed text-zinc-300">
                          {rep.content}
                        </Text>
                      </View>
                    </View>
                  </HapticPressable>
                ))}
              </View>
            </ScrollView>

            {/* Thread Composer */}
            <View className="border-t border-zinc-800/80 bg-zinc-950 p-3">
              {/* Replying banner */}
              {replyingToUser && (
                <View className="mb-2 flex-row items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="arrow-undo" size={12} color="#34d399" />
                    <Text className="text-xs text-zinc-200">
                      Replying directly to{" "}
                      <Text className="font-bold text-emerald-300">
                        @{replyingToUser}
                      </Text>
                    </Text>
                  </View>
                  <HapticPressable
                    accessibilityLabel="Cancel replying directly"
                    onPress={() => setReplyingToUser(null)}
                  >
                    <Ionicons name="close" size={14} color="#a1a1aa" />
                  </HapticPressable>
                </View>
              )}

              {/* Quick mention pills */}
              {activeThreadMessage && (
                <View className="mb-2 flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                    Mention:
                  </Text>
                  {[
                    activeThreadMessage.authorName,
                    ...(activeThreadMessage.replies ?? []).map(
                      (r) => r.authorName
                    ),
                  ]
                    .filter((name, idx, self) => self.indexOf(name) === idx)
                    .slice(0, 4)
                    .map((name) => (
                      <HapticPressable
                        key={`mention_${name}`}
                        className="flex-row items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5"
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setThreadInputText((prev) =>
                            prev.includes(`@${name}`)
                              ? prev
                              : `@${name} ${prev}`
                          );
                        }}
                      >
                        <Ionicons name="at" size={10} color="#34d399" />
                        <Text className="text-[10px] font-semibold text-zinc-300">
                          {name.split(" ")[0]}
                        </Text>
                      </HapticPressable>
                    ))}
                </View>
              )}

              {/* Also send to channel checkbox */}
              <HapticPressable
                className="mb-2 flex-row items-center gap-2"
                onPress={() => setAlsoSendToChannel(!alsoSendToChannel)}
              >
                <Ionicons
                  name={alsoSendToChannel ? "checkbox" : "square-outline"}
                  size={16}
                  color={alsoSendToChannel ? "#34d399" : "#71717a"}
                />
                <Text className="text-xs text-zinc-400">
                  Also send to #{activeChannelId}
                </Text>
              </HapticPressable>

              <View className="flex-row items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2">
                <TextInput
                  className="flex-1 text-xs text-white"
                  placeholder="Reply in thread..."
                  placeholderTextColor="#71717a"
                  value={threadInputText}
                  onChangeText={setThreadInputText}
                  onSubmitEditing={handleSendThreadReply}
                  style={{ fontSize: 15 }}
                />
                <HapticPressable
                  accessibilityLabel="Send thread reply"
                  disabled={!threadInputText.trim()}
                  className={`size-7 items-center justify-center rounded-full ${
                    threadInputText.trim()
                      ? "bg-emerald-500"
                      : "bg-zinc-800 opacity-50"
                  }`}
                  onPress={handleSendThreadReply}
                >
                  <Ionicons
                    name="send"
                    size={12}
                    color={threadInputText.trim() ? "#09090b" : "#71717a"}
                  />
                </HapticPressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 5: SLACK-STYLE ATTACHMENT MENU SHEET */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsSlackAttachmentMenuOpen(false)}
        visible={isSlackAttachmentMenuOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          {/* Top Grab Bar & Header */}
          <View className="items-center pt-2 pb-1">
            <View className="h-1 w-10 rounded-full bg-zinc-700" />
          </View>
          <View className="flex-row items-center justify-between border-b border-zinc-800/80 px-4 py-2.5">
            <Text className="text-sm font-bold text-white">
              Photos &amp; Videos
            </Text>
            <HapticPressable
              accessibilityLabel="View Library"
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setIsPhotoPermissionModalOpen(true);
              }}
            >
              <Text className="text-xs font-semibold text-emerald-400">
                View Library
              </Text>
            </HapticPressable>
          </View>

          {/* Horizontal Media Row: Camera + Thumbnail Tiles */}
          <View className="px-4 py-3.5">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
            >
              {/* Camera Tile */}
              <HapticPressable
                accessibilityLabel="Take photo with camera"
                className="size-24 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setIsPhotoPermissionModalOpen(true);
                }}
              >
                <View className="size-10 items-center justify-center rounded-full bg-zinc-800">
                  <Ionicons name="camera" size={20} color="#34d399" />
                </View>
                <Text className="mt-1 text-[10px] font-medium text-zinc-400">
                  Camera
                </Text>
              </HapticPressable>

              {/* Sample Photo Thumbnails with Selection Rings */}
              {[
                { label: "Bet Slip", subtitle: "4 Legs Cleared", id: "slip_photo_1" },
                { label: "Live Game", subtitle: "BOS vs IND", id: "slip_photo_2" },
                { label: "Shot Chart", subtitle: "Haliburton", id: "slip_photo_3" },
                { label: "Parlay Hit", subtitle: "FanDuel Slip", id: "slip_photo_4" },
              ].map((item) => (
                <HapticPressable
                  key={item.id}
                  accessibilityLabel={`Select ${item.label}`}
                  className="size-24 items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2.5"
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setAttachedPhoto(`${item.label} · ${item.subtitle}`);
                    setIsSlackAttachmentMenuOpen(false);
                  }}
                >
                  <View className="w-full flex-row justify-end">
                    <View className="size-4 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800">
                      <View className="size-2 rounded-full bg-emerald-400" />
                    </View>
                  </View>
                  <View className="w-full items-center">
                    <Ionicons name="image-outline" size={22} color="#a1a1aa" />
                    <Text
                      className="mt-1 text-center font-mono text-[9px] font-bold text-zinc-200"
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                    <Text
                      className="text-center text-[8px] text-zinc-500"
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                </HapticPressable>
              ))}
            </ScrollView>
          </View>

          {/* Slack List Action Items */}
          <ScrollView className="flex-1 px-4">
            <View className="gap-1 border-t border-zinc-800/80 pt-2">
              {/* 1. Record an Audio Clip */}
              <HapticPressable
                className="flex-row items-center gap-3.5 rounded-xl px-3 py-3 active:bg-zinc-900"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setIsSlackAttachmentMenuOpen(false);
                  setInputText((prev) => `${prev} 🎙️ [Audio Clip · 0:14]`);
                }}
              >
                <View className="size-8 items-center justify-center rounded-full bg-zinc-900">
                  <Ionicons name="mic-outline" size={18} color="#e4e4e7" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-white">
                    Record an Audio Clip
                  </Text>
                  <Text className="text-[10px] text-zinc-400">
                    Send quick voice commentary to the room
                  </Text>
                </View>
              </HapticPressable>

              {/* 2. Record a Video Clip */}
              <HapticPressable
                className="flex-row items-center gap-3.5 rounded-xl px-3 py-3 active:bg-zinc-900"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setIsPhotoPermissionModalOpen(true);
                }}
              >
                <View className="size-8 items-center justify-center rounded-full bg-zinc-900">
                  <Ionicons name="videocam-outline" size={18} color="#e4e4e7" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-white">
                    Record a Video Clip
                  </Text>
                  <Text className="text-[10px] text-zinc-400">
                    Live sweat video or reaction
                  </Text>
                </View>
              </HapticPressable>

              {/* 3. Upload a File */}
              <HapticPressable
                className="flex-row items-center gap-3.5 rounded-xl px-3 py-3 active:bg-zinc-900"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsSlackAttachmentMenuOpen(false);
                  setInputText((prev) => `${prev} 📄 [Analytics_Report.pdf]`);
                }}
              >
                <View className="size-8 items-center justify-center rounded-full bg-zinc-900">
                  <Ionicons name="document-text-outline" size={18} color="#e4e4e7" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-white">
                    Upload a File
                  </Text>
                  <Text className="text-[10px] text-zinc-400">
                    PDFs, spreadsheets, data exports
                  </Text>
                </View>
              </HapticPressable>

              {/* 4. Attach Verified Bet Slip */}
              <HapticPressable
                className="flex-row items-center gap-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 active:bg-emerald-500/10"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsSlackAttachmentMenuOpen(false);
                  setIsShareSlipPickerOpen(true);
                }}
              >
                <View className="size-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <Ionicons name="receipt-outline" size={18} color="#34d399" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-emerald-400">
                    Attach Verified Bet Slip
                  </Text>
                  <Text className="text-[10px] text-zinc-400">
                    Sync directly from DraftKings, FanDuel, or Sleeper
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#34d399" />
              </HapticPressable>

              {/* 5. Recent Files & Slips */}
              <HapticPressable
                className="flex-row items-center gap-3.5 rounded-xl px-3 py-3 active:bg-zinc-900"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setIsSlackAttachmentMenuOpen(false);
                  setIsShareSlipPickerOpen(true);
                }}
              >
                <View className="size-8 items-center justify-center rounded-full bg-zinc-900">
                  <Ionicons name="layers-outline" size={18} color="#e4e4e7" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-white">
                    Recent Slips &amp; Files
                  </Text>
                  <Text className="text-[10px] text-zinc-400">
                    Browse previously shared materials
                  </Text>
                </View>
              </HapticPressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 6: SLACK PERMISSION REQUEST MODAL */}
      <Modal
        animationType="fade"
        transparent
        onRequestClose={() => setIsPhotoPermissionModalOpen(false)}
        visible={isPhotoPermissionModalOpen}
      >
        <View className="flex-1 items-center justify-center bg-black/75 px-6">
          <View className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-xl">
            <Text className="text-center text-lg font-black text-white">
              “ParlayPal” Would Like to Access Your Photos
            </Text>
            <Text className="mt-2.5 text-center text-xs leading-relaxed text-zinc-300">
              Upload photos, bet slip screenshots, and live game moments to share with your syndicate workspaces.
            </Text>

            <View className="mt-6 gap-2.5">
              <HapticPressable
                className="w-full items-center justify-center rounded-2xl bg-zinc-800 py-3.5"
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  setIsPhotoPermissionModalOpen(false);
                  setAttachedPhoto("Verified Slip Screenshot");
                  setIsSlackAttachmentMenuOpen(false);
                }}
              >
                <Text className="text-sm font-semibold text-white">
                  Select More Photos...
                </Text>
              </HapticPressable>

              <HapticPressable
                className="w-full items-center justify-center rounded-2xl bg-zinc-800 py-3.5"
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  setIsPhotoPermissionModalOpen(false);
                  setAttachedPhoto("All Photos (Access Granted)");
                  setIsSlackAttachmentMenuOpen(false);
                }}
              >
                <Text className="text-sm font-semibold text-white">
                  Keep Current Selection
                </Text>
              </HapticPressable>

              <HapticPressable
                className="w-full items-center justify-center py-2.5"
                onPress={() => setIsPhotoPermissionModalOpen(false)}
              >
                <Text className="text-xs font-semibold text-zinc-500">
                  Don't Allow
                </Text>
              </HapticPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 7: CATEGORIZED EMOJI PICKER SHEET */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEmojiPickerOpen(false)}
        visible={isEmojiPickerOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          {/* Grab handle */}
          <View className="items-center pt-2 pb-1">
            <View className="h-1 w-10 rounded-full bg-zinc-700" />
          </View>
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-2.5">
            <Text className="text-sm font-bold text-white">
              Emoji Reactions &amp; Badges
            </Text>
            <HapticPressable
              accessibilityLabel="Close emoji picker"
              className="size-7 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsEmojiPickerOpen(false)}
            >
              <Ionicons name="close" size={16} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-3">
            {[
              {
                category: "Reactions & Slips",
                emojis: ["🔥", "💰", "🚀", "🎯", "👀", "🐐", "💎", "🏆", "⚡", "🔒", "📈", "💯"],
              },
              {
                category: "Sports & Leagues",
                emojis: ["🏀", "🏈", "⚾", "🏒", "⚽", "🎾", "🥊", "⛳", "🏎️", "🎳", "🥋", "🏉"],
              },
              {
                category: "Faces & Moods",
                emojis: ["😎", "🤑", "😤", "🥶", "🤯", "🤝", "🫡", "🧠", "🤫", "🤩", "🧐", "🥳"],
              },
              {
                category: "Analytics & Signals",
                emojis: ["📊", "📉", "📋", "🏷️", "🔍", "💡", "🛡️", "🟢", "🔴", "⏱️", "🔮", "🎲"],
              },
            ].map((section) => (
              <View key={section.category} className="mb-5">
                <Text className="mb-2 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                  {section.category}
                </Text>
                <View className="flex-row flex-wrap gap-2.5">
                  {section.emojis.map((emoji) => (
                    <HapticPressable
                      key={emoji}
                      className="size-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900"
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        if (activeThreadMessage) {
                          setThreadInputText((prev) => `${prev}${emoji}`);
                        } else {
                          setInputText((prev) => `${prev}${emoji}`);
                        }
                        setIsEmojiPickerOpen(false);
                      }}
                    >
                      <Text className="text-xl">{emoji}</Text>
                    </HapticPressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* INSTAGRAM-STYLE BETTOR PROFILE MODAL IN CHAT */}
      <BettorProfileModal
        bettor={selectedBettorProfile}
        visible={selectedBettorProfile !== null}
        onClose={() => setSelectedBettorProfile(null)}
        onJoinCommunity={(hubId) => {
          setSelectedBettorProfile(null);
          setActiveCommunityId(hubId);
        }}
        onEnterHub={(hubId) => {
          setSelectedBettorProfile(null);
          setActiveCommunityId(hubId);
        }}
        onMessage={(b) => {
          setSelectedBettorProfile(null);
          setActiveCommunityId(b.syndicateHub?.id ?? "sharp-edge");
        }}
      />

      {/* REUSABLE TICKET ID MODAL FOR INSPECTING SLIPS */}
      <TicketDetailModal
        onClose={() => setSelectedTicket(null)}
        ticket={selectedTicket}
        visible={selectedTicket !== null}
      />
    </SafeAreaView>
  );
}
