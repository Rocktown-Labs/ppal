import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
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
import type { MobileTicket } from "@/lib/api-client";
import { useProfileData } from "@/lib/api-client";
import { useAppState } from "@/lib/app-state";

type ProfileTab = "profile" | "billing" | "notifications" | "referrals";

const TABS: Array<{
  id: ProfileTab;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = [
  { id: "profile", icon: "person", label: "Profile" },
  { id: "billing", icon: "card", label: "Billing" },
  { id: "notifications", icon: "notifications", label: "Triggers" },
  { id: "referrals", icon: "gift", label: "Referrals" },
];

const DISCOVER_BETTORS = [
  {
    avatar: "MR",
    followers: "3.4k",
    handle: "marcus_prop",
    hitRate: "72%",
    name: "Marcus Rivera",
    specialty: "NBA Player Props",
  },
  {
    avatar: "SC",
    followers: "2.1k",
    handle: "statline_sarah",
    hitRate: "69%",
    name: "Sarah Chen",
    specialty: "WNBA & MLB Hits",
  },
  {
    avatar: "GG",
    followers: "5.8k",
    handle: "gridironguru",
    hitRate: "65%",
    name: "Gridiron Guru",
    specialty: "NFL Touchdown Sweats",
  },
];

const USER_PROFILE_TICKETS: MobileTicket[] = [
  {
    createdAt: new Date().toISOString(),
    id: "tkt_user_01",
    legs: [
      {
        currentValue: 28,
        id: "leg_u1",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 26.5 Points",
        status: "won",
        subjectName: "Jayson Tatum",
        targetValue: 26.5,
        wonAt: "4Q 2:10",
      },
      {
        currentValue: 4,
        id: "leg_u2",
        marketDescription: "Made 3-Point Field Goals",
        operator: "over",
        rawDescription: "Over 2.5 Made 3PT",
        status: "won",
        subjectName: "Jaylen Brown",
        targetValue: 2.5,
        wonAt: "3Q 1:15",
      },
      {
        currentValue: 11,
        id: "leg_u3",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 9.5 Assists",
        status: "won",
        subjectName: "Tyrese Haliburton",
        targetValue: 9.5,
        wonAt: "4Q 0:45",
      },
      {
        currentValue: 8,
        id: "leg_u4",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 6.5 Rebounds",
        status: "won",
        subjectName: "Myles Turner",
        targetValue: 6.5,
        wonAt: "4Q 3:12",
      },
    ],
    odds: "",
    originalStake: 50,
    sourceName: "DraftKings",
    sportsEvent: "BOS Celtics @ IND Pacers",
    status: "won",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    id: "tkt_user_02",
    legs: [
      {
        currentValue: 32,
        id: "leg_u5",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 30.5 Points",
        status: "won",
        subjectName: "Giannis Antetokounmpo",
        targetValue: 30.5,
        wonAt: "4Q 4:10",
      },
      {
        currentValue: 8,
        id: "leg_u6",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 6.5 Assists",
        status: "won",
        subjectName: "Damian Lillard",
        targetValue: 6.5,
        wonAt: "3Q 2:05",
      },
      {
        currentValue: 24,
        id: "leg_u7",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 22.5 Points",
        status: "won",
        subjectName: "Tyrese Maxey",
        targetValue: 22.5,
        wonAt: "4Q 1:12",
      },
    ],
    odds: "",
    originalStake: 40,
    sourceName: "FanDuel",
    sportsEvent: "MIL Bucks @ PHI 76ers",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date().toISOString(),
    id: "tkt_user_03",
    legs: [
      {
        currentValue: 26,
        id: "leg_u8",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 24.5 Points",
        status: "won",
        subjectName: "Anthony Davis",
        targetValue: 24.5,
        wonAt: "3Q 5:00",
      },
      {
        currentValue: 9,
        id: "leg_u9",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 8.5 Assists",
        status: "won",
        subjectName: "LeBron James",
        targetValue: 8.5,
        wonAt: "4Q 8:20",
      },
      {
        currentValue: 14,
        id: "leg_u10",
        marketDescription: "Rebounds",
        operator: "over",
        rawDescription: "Over 12.5 Rebounds",
        status: "won",
        subjectName: "Nikola Jokic",
        targetValue: 12.5,
        wonAt: "4Q 1:12",
      },
    ],
    odds: "",
    originalStake: 60,
    sourceName: "BetMGM",
    sportsEvent: "LAL Lakers @ DEN Nuggets",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date().toISOString(),
    id: "tkt_user_04",
    legs: [
      {
        currentValue: 29,
        id: "leg_u11",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 27.5 Points",
        status: "won",
        subjectName: "Jalen Brunson",
        targetValue: 27.5,
        wonAt: "4Q 6:00",
      },
      {
        currentValue: 7,
        id: "leg_u12",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 6.5 Assists",
        status: "won",
        subjectName: "Josh Hart",
        targetValue: 6.5,
        wonAt: "4Q 1:10",
      },
      {
        currentValue: 19,
        id: "leg_u13",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 20.5 Points",
        status: "lost",
        subjectName: "Bam Adebayo",
        targetValue: 20.5,
        lostAt: "Final",
      },
      {
        currentValue: 4,
        id: "leg_u14",
        marketDescription: "Made 3-Point Field Goals",
        operator: "over",
        rawDescription: "Over 3.5 Made 3PT",
        status: "won",
        subjectName: "Tyler Herro",
        targetValue: 3.5,
        wonAt: "4Q 0:42",
      },
    ],
    odds: "",
    originalStake: 30,
    sourceName: "Caesars",
    sportsEvent: "NY Knicks @ MIA Heat",
    status: "lost",
    ticketType: "sgp",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    id: "tkt_user_05",
    legs: [
      {
        currentValue: 29,
        id: "leg_u15",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 28.5 Points",
        status: "won",
        subjectName: "Stephen Curry",
        targetValue: 28.5,
        wonAt: "4Q 3:20",
      },
      {
        currentValue: 5,
        id: "leg_u16",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 6.5 Assists",
        status: "lost",
        subjectName: "Draymond Green",
        targetValue: 6.5,
        lostAt: "Final",
      },
      {
        currentValue: 27,
        id: "leg_u17",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 25.5 Points",
        status: "won",
        subjectName: "Devin Booker",
        targetValue: 25.5,
        wonAt: "4Q 0:30",
      },
    ],
    odds: "",
    originalStake: 45,
    sourceName: "DraftKings",
    sportsEvent: "GS Warriors @ PHX Suns",
    status: "lost",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
  {
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    id: "tkt_user_06",
    legs: [
      {
        currentValue: 34,
        id: "leg_u18",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 31.5 Points",
        status: "won",
        subjectName: "Luka Doncic",
        targetValue: 31.5,
        wonAt: "4Q 5:10",
      },
      {
        currentValue: 9,
        id: "leg_u19",
        marketDescription: "Assists",
        operator: "over",
        rawDescription: "Over 8.5 Assists",
        status: "won",
        subjectName: "Kyrie Irving",
        targetValue: 8.5,
        wonAt: "4Q 2:05",
      },
      {
        currentValue: 31,
        id: "leg_u20",
        marketDescription: "Points",
        operator: "over",
        rawDescription: "Over 29.5 Points",
        status: "won",
        subjectName: "Shai Gilgeous-Alexander",
        targetValue: 29.5,
        wonAt: "4Q 1:15",
      },
    ],
    odds: "",
    originalStake: 55,
    sourceName: "FanDuel",
    sportsEvent: "DAL Mavericks @ OKC Thunder",
    status: "won",
    ticketType: "parlay",
    verificationStatus: "verified",
  },
];

export default function ProfileScreen() {
  const { logout } = useAppState();
  const { data: profile } = useProfileData();

  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");

  // Read-only vs Edit Profile Mode
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(
    profile?.name ?? "Cameron Stewart"
  );
  const [handle, setHandle] = useState(profile?.handle ?? "cgstewart");
  const [bio, setBio] = useState(
    "NBA player prop specialist. Heavy focus on rebounds and assists."
  );
  const [visibility, setVisibility] = useState<"private" | "public">("public");

  // Draft editing states (to allow discard)
  const [draftName, setDraftName] = useState(displayName);
  const [draftHandle, setDraftHandle] = useState(handle);
  const [draftBio, setDraftBio] = useState(bio);
  const [draftVisibility, setDraftVisibility] = useState(visibility);

  // Instagram-style Public Profile Modal
  const [isPublicProfileModalOpen, setIsPublicProfileModalOpen] =
    useState(false);
  const [followedBettors, setFollowedBettors] = useState<
    Record<string, boolean>
  >({});

  // Billing tier selection
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "creator">("pro");

  // Triggers: 2x2 Grid States
  const [pushAlerts, setPushAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [inAppBanner, setInAppBanner] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  // Game Milestones: 2x2 Grid States
  const [legHits, setLegHits] = useState(true);
  const [legMisses, setLegMisses] = useState(true);
  const [parlayCashes, setParlayCashes] = useState(true);
  const [parlaySettledLost, setParlaySettledLost] = useState(true);

  // Referrals Share Sheet Modal
  const [isReferralShareModalOpen, setIsReferralShareModalOpen] =
    useState(false);

  // Security & Password States
  const [isSecurityAuthValid, setIsSecurityAuthValid] = useState(false);
  const [isAuthPromptModalOpen, setIsAuthPromptModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Sign Out Modal State
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [signOutAllDevices, setSignOutAllDevices] = useState(false);

  const userProfileBettorData: BettorProfileData = {
    avatar: displayName.slice(0, 2).toUpperCase(),
    bio: bio,
    followersCount: "1.8k",
    followingCount: "56",
    handle: handle,
    hitRate: "68%",
    id: "user_cgstewart",
    isFollowing: false,
    isVerified: true,
    name: displayName,
    slipsCount: 142,
    socialProof: {
      avatarInitials: ["MR", "SC", "GG"],
      followedByText: "Followed by marcus_prop, baller_jay and 42 others",
    },
    specialty: "NBA & MLB Prop Specialist",
    syndicateHub: {
      description: "Live 4Q prop sweat threads",
      id: "sharp-edge",
      membersCount: "4.2k members",
      name: "The Sharp Edge Syndicate",
    },
    tags: ["🏀 NBA Props", "⚾ MLB Hits", "🏈 RedZone"],
    tickets: USER_PROFILE_TICKETS,
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsPublicProfileModalOpen(false);
        setIsEditingProfile(false);
        setIsReferralShareModalOpen(false);
        setIsAuthPromptModalOpen(false);
        setIsSecurityModalOpen(false);
        setIsSignOutModalOpen(false);
      };
    }, [])
  );

  const handleStartEditing = () => {
    Haptics.selectionAsync().catch(() => {});
    setDraftName(displayName);
    setDraftHandle(handle);
    setDraftBio(bio);
    setDraftVisibility(visibility);
    setIsEditingProfile(true);
  };

  const handleDiscardEditing = () => {
    Haptics.selectionAsync().catch(() => {});
    setIsEditingProfile(false);
  };

  const handleSaveEditing = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDisplayName(draftName);
    setHandle(draftHandle);
    setBio(draftBio);
    setVisibility(draftVisibility);
    setIsEditingProfile(false);
    Alert.alert("Profile Updated", "Your changes have been saved.");
  };

  const handleSharePublicScorecard = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Check out my verified betting scorecard on ParlayPal: 68% Win Rate across 142 bets. https://myparlaypal.com/u/${handle}`,
        title: "Verified ParlayPal Scorecard",
      });
    } catch {
      // Dismissed
    }
  };

  const handleCopyReferralLink = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsReferralShareModalOpen(true);
  };

  const handleShareReferralLink = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message:
          "Track verified sports bet slips, monitor live legs in real-time, and join sharp betting syndicates on ParlayPal: https://myparlaypal.com/r/X9NYZVEE",
        title: "Join ParlayPal",
      });
    } catch {
      // Dismissed
    }
  };

  const handleOpenSecurity = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isSecurityAuthValid) {
      setIsSecurityModalOpen(true);
    } else {
      setIsAuthPromptModalOpen(true);
    }
  };

  const handleAuthenticateSecurity = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSecurityAuthValid(true);
    setIsAuthPromptModalOpen(false);
    setIsSecurityModalOpen(true);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert("Password Required", "Please enter a new password.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert("Mismatch", "New passwords do not match.");
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setIsSecurityModalOpen(false);
    Alert.alert(
      "Password Changed",
      "Your password has been successfully updated."
    );
  };

  const handleConfirmSignOut = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSignOutModalOpen(false);
    await logout();
    router.replace("/(auth)");
  };

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
        {/* User Identity Header */}
        <View className="mb-4 flex-row items-center gap-3.5">
          <View className="size-14 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10">
            <Text className="font-mono text-lg font-black text-emerald-400">
              {displayName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="text-base font-black text-white">
                {displayName}
              </Text>
              <View className="flex-row items-center gap-0.5 rounded-full bg-emerald-500/20 px-2 py-0.5">
                <Ionicons name="checkmark-circle" size={11} color="#34d399" />
                <Text className="text-[10px] font-bold text-emerald-400">
                  Verified Bettor
                </Text>
              </View>
            </View>
            <Text className="text-xs text-zinc-400">
              @{handle} · Member since Nov 2024
            </Text>
            <Text className="font-mono text-[10px] text-zinc-500">
              Public URL: /u/{handle}
            </Text>
          </View>
        </View>

        {/* Section Navigation Tabs */}
        <View className="mb-5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <HapticPressable
                  key={tab.id}
                  className={`flex-row items-center gap-1.5 rounded-xl px-3 py-2 ${
                    active
                      ? "border border-zinc-700 bg-zinc-800"
                      : "border border-zinc-800/80 bg-zinc-900/60"
                  }`}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab(tab.id);
                  }}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={active ? "#34d399" : "#a1a1aa"}
                  />
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-zinc-400"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </HapticPressable>
              );
            })}
          </ScrollView>
        </View>

        {/* TAB 1: PROFILE (READ-ONLY SUMMARY BY DEFAULT WITH EDIT BUTTON) */}
        {activeTab === "profile" && (
          <View className="gap-4">
            <GlassCard className="p-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                    ACCOUNT & IDENTITY
                  </Text>
                  <Text className="mt-0.5 text-base font-bold text-white">
                    Bettor Profile
                  </Text>
                </View>

                {!isEditingProfile && (
                  <HapticPressable
                    className="flex-row items-center gap-1 rounded-xl bg-zinc-800 px-3 py-1.5"
                    onPress={handleStartEditing}
                  >
                    <Ionicons name="pencil" size={12} color="#34d399" />
                    <Text className="text-xs font-bold text-white">
                      Edit Profile
                    </Text>
                  </HapticPressable>
                )}
              </View>

              {/* READ-ONLY VIEW (DEFAULT) */}
              {!isEditingProfile ? (
                <View className="mt-3.5 gap-3">
                  <View className="rounded-xl bg-zinc-950 p-3">
                    <Text className="text-[10px] font-bold text-zinc-500 uppercase">
                      DISPLAY NAME
                    </Text>
                    <Text className="mt-1 text-sm font-bold text-white">
                      {displayName}
                    </Text>
                    <Text className="mt-0.5 text-[10px] text-zinc-500">
                      Signed in as: camgstewart@icloud.com
                    </Text>
                  </View>

                  <View className="rounded-xl bg-zinc-950 p-3">
                    <Text className="text-[10px] font-bold text-zinc-500 uppercase">
                      USERNAME HANDLE
                    </Text>
                    <Text className="mt-1 font-mono text-sm font-bold text-emerald-400">
                      @{handle}
                    </Text>
                    <Text className="mt-0.5 font-mono text-[10px] text-zinc-500">
                      Public address: myparlaypal.com/u/{handle}
                    </Text>
                  </View>

                  <View className="rounded-xl bg-zinc-950 p-3">
                    <Text className="text-[10px] font-bold text-zinc-500 uppercase">
                      STRATEGY & BIO
                    </Text>
                    <Text className="mt-1 text-xs leading-relaxed text-zinc-300">
                      {bio}
                    </Text>
                  </View>

                  <View className="rounded-xl bg-zinc-950 p-3">
                    <Text className="text-[10px] font-bold text-zinc-500 uppercase">
                      VISIBILITY MODE
                    </Text>
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <Ionicons
                        name={
                          visibility === "public"
                            ? "globe-outline"
                            : "lock-closed-outline"
                        }
                        size={14}
                        color="#34d399"
                      />
                      <Text className="text-xs font-bold text-white">
                        {visibility === "public"
                          ? "Public Scorecard"
                          : "Private Record"}
                      </Text>
                    </View>
                  </View>

                  {/* Public Profile View Trigger Button */}
                  <HapticPressable
                    className="mt-2 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 shadow-md shadow-emerald-500/20"
                    onPress={() => {
                      Haptics.impactAsync(
                        Haptics.ImpactFeedbackStyle.Light
                      ).catch(() => {});
                      setIsPublicProfileModalOpen(true);
                    }}
                  >
                    <Ionicons name="eye-outline" size={16} color="#09090b" />
                    <Text className="text-xs font-bold text-zinc-950">
                      View Public Profile
                    </Text>
                  </HapticPressable>
                </View>
              ) : (
                /* EDITING VIEW (ACTIVE WHEN USER CLICKS EDIT PROFILE) */
                <View className="mt-3.5 gap-3.5">
                  <View>
                    <Text className="text-xs font-semibold text-zinc-300">
                      Display Name
                    </Text>
                    <TextInput
                      className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                      value={draftName}
                      onChangeText={setDraftName}
                      style={{ fontSize: 16 }}
                    />
                  </View>

                  <View>
                    <Text className="text-xs font-semibold text-zinc-300">
                      Username Handle
                    </Text>
                    <View className="mt-1.5 flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5">
                      <Text className="font-mono text-xs text-zinc-500">@</Text>
                      <TextInput
                        className="ml-1.5 flex-1 text-xs text-white"
                        value={draftHandle}
                        onChangeText={setDraftHandle}
                        style={{ fontSize: 16 }}
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-xs font-semibold text-zinc-300">
                      Bio / Strategy
                    </Text>
                    <TextInput
                      className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white"
                      value={draftBio}
                      onChangeText={setDraftBio}
                      multiline
                      numberOfLines={2}
                      style={{ fontSize: 16 }}
                    />
                  </View>

                  {/* Visibility Radio Options */}
                  <View>
                    <Text className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                      PUBLIC VISIBILITY
                    </Text>
                    <View className="mt-2 flex-row gap-2.5">
                      <HapticPressable
                        className={`flex-1 rounded-xl border p-3 ${
                          draftVisibility === "private"
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-zinc-800 bg-zinc-950"
                        }`}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setDraftVisibility("private");
                        }}
                      >
                        <Text className="text-xs font-bold text-white">
                          Private
                        </Text>
                        <Text className="mt-0.5 text-[9px] text-zinc-400">
                          Hidden from public
                        </Text>
                      </HapticPressable>

                      <HapticPressable
                        className={`flex-1 rounded-xl border p-3 ${
                          draftVisibility === "public"
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-zinc-800 bg-zinc-950"
                        }`}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setDraftVisibility("public");
                        }}
                      >
                        <Text className="text-xs font-bold text-white">
                          Public
                        </Text>
                        <Text className="mt-0.5 text-[9px] text-zinc-400">
                          Show verified hit rate
                        </Text>
                      </HapticPressable>
                    </View>
                  </View>

                  {/* Action Row: Discard & Save */}
                  <View className="mt-2 flex-row items-center gap-2.5">
                    <HapticPressable
                      className="flex-1 items-center rounded-xl border border-zinc-800 bg-zinc-900 py-3"
                      onPress={handleDiscardEditing}
                    >
                      <Text className="text-xs font-bold text-zinc-400">
                        Discard
                      </Text>
                    </HapticPressable>

                    <HapticPressable
                      className="flex-1 items-center rounded-xl bg-emerald-500 py-3 shadow-md shadow-emerald-500/20"
                      onPress={handleSaveEditing}
                    >
                      <Text className="text-xs font-bold text-zinc-950">
                        Save Changes
                      </Text>
                    </HapticPressable>
                  </View>
                </View>
              )}
            </GlassCard>

            {/* BOTTOM ACTION BUTTONS: SECURITY & PASSWORD + SIGN OUT SIDE-BY-SIDE (ONLY ON PROFILE TAB) */}
            <View className="mt-2 flex-row items-center gap-3">
              {/* Button 1: Security & Password */}
              <HapticPressable
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 py-3.5"
                onPress={handleOpenSecurity}
              >
                <Ionicons name="shield-outline" size={16} color="#34d399" />
                <Text className="text-xs font-bold text-zinc-200">
                  Security
                </Text>
              </HapticPressable>

              {/* Button 2: Sign Out (Red Destructive) */}
              <HapticPressable
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-3.5"
                onPress={() => setIsSignOutModalOpen(true)}
              >
                <Ionicons name="log-out-outline" size={16} color="#fb7185" />
                <Text className="text-xs font-bold text-rose-400">
                  Sign Out
                </Text>
              </HapticPressable>
            </View>
          </View>
        )}

        {/* TAB 2: BILLING (PRO & CREATOR PLANS ONLY WITH PROPER SPACING - NO CURRENCY SYMBOLS) */}
        {activeTab === "billing" && (
          <View className="gap-5">
            {/* Header intro */}
            <View>
              <Text className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
                MEMBERSHIP TIERS
              </Text>
              <Text className="mt-0.5 text-2xl font-black text-white">
                Choose Your Plan
              </Text>
              <Text className="mt-1 text-xs text-zinc-400">
                Transparent flat pricing for sharp prop bettors and syndicate
                creators
              </Text>
            </View>

            {/* Plan 1: Pro Plan (12.99 / mo) */}
            <GlassCard
              className="p-5"
              variant={selectedPlan === "pro" ? "accent" : "default"}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="font-mono text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                    FOR SERIOUS BETTORS
                  </Text>
                  <Text className="text-lg font-black text-white">
                    Pro Plan
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className="font-mono text-2xl font-black text-white"
                    style={styles.tabular}
                  >
                    12.99
                  </Text>
                  <Text className="text-[10px] text-zinc-400">/ month</Text>
                </View>
              </View>

              <View className="mt-4 space-y-2 border-t border-zinc-800/80 pt-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    500 bet slips tracked per month
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Real-time 5-minute live stat updates
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Instant AI Multimodal OCR extraction
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Push and email trigger notifications
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Public scorecard URL profile (/u/{handle})
                  </Text>
                </View>
              </View>

              <HapticPressable
                className={`mt-5 items-center rounded-xl py-3.5 ${
                  selectedPlan === "pro"
                    ? "bg-zinc-800"
                    : "bg-emerald-500 shadow-md shadow-emerald-500/20"
                }`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedPlan("pro");
                  Alert.alert("Pro Plan", "Switched to Pro Plan (12.99 / mo).");
                }}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedPlan === "pro" ? "text-white" : "text-zinc-950"
                  }`}
                >
                  {selectedPlan === "pro"
                    ? "Current Active Plan"
                    : "Switch to Pro (12.99 / mo)"}
                </Text>
              </HapticPressable>
            </GlassCard>

            {/* Plan 2: Creator Plan (24.99 / mo) */}
            <GlassCard
              className="p-5"
              variant={selectedPlan === "creator" ? "accent" : "default"}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-mono text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                      FOR SYNDICATES & CAPPERS
                    </Text>
                    <View className="rounded bg-emerald-500/20 px-1.5 py-0.2">
                      <Text className="font-mono text-[9px] font-bold text-emerald-400">
                        POPULAR
                      </Text>
                    </View>
                  </View>
                  <Text className="text-lg font-black text-white">
                    Creator Plan
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className="font-mono text-2xl font-black text-emerald-400"
                    style={styles.tabular}
                  >
                    24.99
                  </Text>
                  <Text className="text-[10px] text-zinc-400">/ month</Text>
                </View>
              </View>

              <View className="mt-4 space-y-2 border-t border-zinc-800/80 pt-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="sparkles" size={15} color="#34d399" />
                  <Text className="text-xs font-bold text-white">
                    Includes all Pro features plus:
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Host your own Community & VIP Chat Room
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Monetize pick subscriptions via Stripe
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Instant push broadcast of pinned slips
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Verified Creator badge & community directory listing
                  </Text>
                </View>
              </View>

              <HapticPressable
                className={`mt-5 items-center rounded-xl py-3.5 ${
                  selectedPlan === "creator"
                    ? "bg-zinc-800"
                    : "bg-emerald-500 shadow-md shadow-emerald-500/20"
                }`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedPlan("creator");
                  Alert.alert(
                    "Creator Plan",
                    "Upgrading to Creator Tier (24.99 / mo)..."
                  );
                }}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedPlan === "creator" ? "text-white" : "text-zinc-950"
                  }`}
                >
                  {selectedPlan === "creator"
                    ? "Current Active Plan"
                    : "Upgrade to Creator (24.99 / mo)"}
                </Text>
              </HapticPressable>
            </GlassCard>
          </View>
        )}

        {/* TAB 3: NOTIFICATION TRIGGERS (2x2 GRIDS FOR DELIVERY CHANNELS & GAME MILESTONES) */}
        {activeTab === "notifications" && (
          <View className="gap-5">
            <GlassCard className="p-4">
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color="#34d399"
                />
                <Text className="text-sm font-bold text-white">
                  Notification Triggers
                </Text>
              </View>
              <Text className="mt-0.5 text-xs text-zinc-400">
                Choose delivery channels and game events that trigger alerts
              </Text>

              {/* 1. DELIVERY CHANNELS (2x2 GRID) */}
              <Text className="mt-4 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                DELIVERY CHANNELS
              </Text>

              <View className="mt-2.5 gap-2.5">
                {/* Row 1: Push & Email */}
                <View className="flex-row gap-2.5">
                  <HapticPressable
                    className={`flex-1 rounded-xl border p-3 ${
                      pushAlerts
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setPushAlerts(!pushAlerts)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Ionicons
                        name="phone-portrait-outline"
                        size={16}
                        color={pushAlerts ? "#34d399" : "#a1a1aa"}
                      />
                      <Ionicons
                        name={pushAlerts ? "checkbox" : "square-outline"}
                        size={16}
                        color={pushAlerts ? "#34d399" : "#71717a"}
                      />
                    </View>
                    <Text className="mt-2 text-xs font-bold text-white">
                      Push Alerts
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-zinc-400">
                      Instant lockscreen
                    </Text>
                  </HapticPressable>

                  <HapticPressable
                    className={`flex-1 rounded-xl border p-3 ${
                      emailDigest
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setEmailDigest(!emailDigest)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Ionicons
                        name="mail-outline"
                        size={16}
                        color={emailDigest ? "#34d399" : "#a1a1aa"}
                      />
                      <Ionicons
                        name={emailDigest ? "checkbox" : "square-outline"}
                        size={16}
                        color={emailDigest ? "#34d399" : "#71717a"}
                      />
                    </View>
                    <Text className="mt-2 text-xs font-bold text-white">
                      Email Digest
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-zinc-400">
                      Daily recap report
                    </Text>
                  </HapticPressable>
                </View>

                {/* Row 2: In-App & SMS */}
                <View className="flex-row gap-2.5">
                  <HapticPressable
                    className={`flex-1 rounded-xl border p-3 ${
                      inAppBanner
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setInAppBanner(!inAppBanner)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Ionicons
                        name="notifications-circle-outline"
                        size={16}
                        color={inAppBanner ? "#34d399" : "#a1a1aa"}
                      />
                      <Ionicons
                        name={inAppBanner ? "checkbox" : "square-outline"}
                        size={16}
                        color={inAppBanner ? "#34d399" : "#71717a"}
                      />
                    </View>
                    <Text className="mt-2 text-xs font-bold text-white">
                      In-App Banner
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-zinc-400">
                      Live toast bar
                    </Text>
                  </HapticPressable>

                  <HapticPressable
                    className={`flex-1 rounded-xl border p-3 ${
                      smsAlerts
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setSmsAlerts(!smsAlerts)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Ionicons
                        name="chatbox-outline"
                        size={16}
                        color={smsAlerts ? "#34d399" : "#a1a1aa"}
                      />
                      <Ionicons
                        name={smsAlerts ? "checkbox" : "square-outline"}
                        size={16}
                        color={smsAlerts ? "#34d399" : "#71717a"}
                      />
                    </View>
                    <Text className="mt-2 text-xs font-bold text-white">
                      SMS Alerts
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-zinc-400">
                      Pro & Creator tier
                    </Text>
                  </HapticPressable>
                </View>
              </View>

              {/* 2. GAME MILESTONES (2x2 GRID) */}
              <Text className="mt-5 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                GAME MILESTONES
              </Text>

              <View className="mt-2.5 gap-2.5">
                {/* Row 1: Leg Hits & Leg Misses */}
                <View className="flex-row gap-2.5">
                  <HapticPressable
                    className={`flex-1 rounded-xl border p-3 ${
                      legHits
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setLegHits(!legHits)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={16}
                        color={legHits ? "#34d399" : "#a1a1aa"}
                      />
                      <Ionicons
                        name={legHits ? "checkbox" : "square-outline"}
                        size={16}
                        color={legHits ? "#34d399" : "#71717a"}
                      />
                    </View>
                    <Text className="mt-2 text-xs font-bold text-white">
                      Leg Hits (Won)
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-zinc-400">
                      When prop clears line
                    </Text>
                  </HapticPressable>

                  <HapticPressable
                    className={`flex-1 rounded-xl border p-3 ${
                      legMisses
                        ? "border-rose-500/40 bg-rose-500/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setLegMisses(!legMisses)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Ionicons
                        name="close-circle-outline"
                        size={16}
                        color={legMisses ? "#fb7185" : "#a1a1aa"}
                      />
                      <Ionicons
                        name={legMisses ? "checkbox" : "square-outline"}
                        size={16}
                        color={legMisses ? "#fb7185" : "#71717a"}
                      />
                    </View>
                    <Text className="mt-2 text-xs font-bold text-white">
                      Leg Misses (Lost)
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-zinc-400">
                      Player out / missed
                    </Text>
                  </HapticPressable>
                </View>

                {/* Row 2: Full Cash & Settled Lost */}
                <View className="flex-row gap-2.5">
                  <HapticPressable
                    className={`flex-1 rounded-xl border p-3 ${
                      parlayCashes
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setParlayCashes(!parlayCashes)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Ionicons
                        name="trophy-outline"
                        size={16}
                        color={parlayCashes ? "#34d399" : "#a1a1aa"}
                      />
                      <Ionicons
                        name={parlayCashes ? "checkbox" : "square-outline"}
                        size={16}
                        color={parlayCashes ? "#34d399" : "#71717a"}
                      />
                    </View>
                    <Text className="mt-2 text-xs font-bold text-white">
                      Slip Cashed
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-zinc-400">
                      Full ticket win
                    </Text>
                  </HapticPressable>

                  <HapticPressable
                    className={`flex-1 rounded-xl border p-3 ${
                      parlaySettledLost
                        ? "border-zinc-700 bg-zinc-900"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setParlaySettledLost(!parlaySettledLost)}
                  >
                    <View className="flex-row items-center justify-between">
                      <Ionicons
                        name="archive-outline"
                        size={16}
                        color={parlaySettledLost ? "#e4e4e7" : "#71717a"}
                      />
                      <Ionicons
                        name={parlaySettledLost ? "checkbox" : "square-outline"}
                        size={16}
                        color={parlaySettledLost ? "#34d399" : "#71717a"}
                      />
                    </View>
                    <Text className="mt-2 text-xs font-bold text-white">
                      Slip Lost
                    </Text>
                    <Text className="mt-0.5 text-[9px] text-zinc-400">
                      Settlement summary
                    </Text>
                  </HapticPressable>
                </View>
              </View>

              <HapticPressable
                className="mt-5 items-center rounded-xl bg-emerald-500 py-3.5 shadow-md shadow-emerald-500/20"
                onPress={async () => {
                  await Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  );
                  Alert.alert("Saved", "Trigger preferences updated.");
                }}
              >
                <Text className="text-xs font-bold text-zinc-950">
                  Save Trigger Preferences
                </Text>
              </HapticPressable>
            </GlassCard>
          </View>
        )}

        {/* TAB 4: REFERRALS */}
        {activeTab === "referrals" && (
          <View className="gap-4">
            <GlassCard className="p-4">
              <View className="flex-row items-center gap-2">
                <Ionicons name="gift-outline" size={18} color="#34d399" />
                <Text className="text-sm font-bold text-white">
                  Referral Program & Invites
                </Text>
              </View>
              <Text className="mt-0.5 text-xs text-zinc-400">
                Invite fellow bettors to ParlayPal and unlock free Pro passes
              </Text>

              <View className="mt-3.5 rounded-xl bg-zinc-950 p-3.5">
                <Text className="text-[10px] font-bold text-zinc-500 uppercase">
                  YOUR REFERRAL LINK
                </Text>
                <Text className="mt-1 font-mono text-xs text-zinc-300">
                  https://myparlaypal.com/r/X9NYZVEE
                </Text>

                <View className="mt-3 flex-row items-center gap-2">
                  <HapticPressable
                    className="flex-1 items-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 py-2.5"
                    onPress={handleCopyReferralLink}
                  >
                    <Text className="text-xs font-bold text-emerald-400">
                      Copy Link
                    </Text>
                  </HapticPressable>

                  <HapticPressable
                    className="flex-1 items-center rounded-xl bg-emerald-500 py-2.5 shadow-md shadow-emerald-500/20"
                    onPress={handleShareReferralLink}
                  >
                    <Text className="text-xs font-bold text-zinc-950">
                      Share Link...
                    </Text>
                  </HapticPressable>
                </View>
              </View>

              {/* Referral Milestones & Rewards */}
              <View className="mt-4 space-y-2 border-t border-zinc-800/80 pt-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="sparkles" size={14} color="#34d399" />
                  <Text className="text-xs text-zinc-300">
                    Both you and your referred bettor unlock 1 Month Pro Pass
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="trophy-outline" size={14} color="#34d399" />
                  <Text className="text-xs text-zinc-300">
                    5 verified invites: Lifetime Syndicate Creator badge
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>
        )}
      </ScrollView>

      {/* MODAL 1: REFERRAL SHARE MODAL SHEET */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsReferralShareModalOpen(false)}
        visible={isReferralShareModalOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                REFERRAL INVITE
              </Text>
              <Text className="text-base font-bold text-white">
                Share Referral Link
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close referral share modal"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsReferralShareModalOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            <View className="mb-5 items-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <View className="size-12 items-center justify-center rounded-full bg-emerald-500/20">
                <Ionicons name="gift" size={24} color="#34d399" />
              </View>
              <Text className="mt-3 text-base font-black text-white">
                Invite Link Copied!
              </Text>
              <Text className="mt-1 text-center text-xs text-zinc-300">
                Share your personalized invite link with fellow bettors to unlock mutual Pro access.
              </Text>
            </View>

            <View className="rounded-xl border border-zinc-800 bg-zinc-900 p-3.5">
              <Text className="text-[10px] font-bold text-zinc-500 uppercase">
                INVITE URL
              </Text>
              <Text className="mt-1 font-mono text-xs text-emerald-400">
                https://myparlaypal.com/r/X9NYZVEE
              </Text>
            </View>

            <HapticPressable
              className="mt-4 flex-row items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 shadow-md shadow-emerald-500/25"
              onPress={handleShareReferralLink}
            >
              <Ionicons name="share-social" size={16} color="#09090b" />
              <Text className="text-xs font-bold text-zinc-950">
                Share Link...
              </Text>
            </HapticPressable>

            <View className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                REFERRAL PERKS
              </Text>
              <View className="mt-3 space-y-2.5">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    1 Month Pro pass for every invited bettor who creates an account
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={15} color="#34d399" />
                  <Text className="text-xs text-zinc-200">
                    Invite 5 friends to unlock the verified Creator badge & Syndicate hosting
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 2: BIOMETRIC / PASSCODE AUTH CHECK MODAL */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsAuthPromptModalOpen(false)}
        visible={isAuthPromptModalOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                AUTHENTICATION
              </Text>
              <Text className="text-base font-bold text-white">
                Verify Identity
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close auth prompt modal"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsAuthPromptModalOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <View className="flex-1 items-center justify-center px-6">
            <View className="size-20 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
              <Ionicons name="finger-print-outline" size={44} color="#34d399" />
            </View>

            <Text className="mt-5 text-lg font-black text-white text-center">
              Security Verification Required
            </Text>
            <Text className="mt-2 text-center text-xs leading-relaxed text-zinc-400">
              To update your password and security credentials, please verify your biometric or device credentials for today's session.
            </Text>

            <HapticPressable
              className="mt-6 w-full flex-row items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 shadow-md shadow-emerald-500/25"
              onPress={handleAuthenticateSecurity}
            >
              <Ionicons name="lock-open-outline" size={16} color="#09090b" />
              <Text className="text-xs font-bold text-zinc-950">
                Authenticate with Face ID / Passcode
              </Text>
            </HapticPressable>

            <HapticPressable
              className="mt-3 py-2"
              onPress={() => setIsAuthPromptModalOpen(false)}
            >
              <Text className="text-xs text-zinc-500">Cancel</Text>
            </HapticPressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL 3: SECURITY & PASSWORD CHANGE MODAL */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsSecurityModalOpen(false)}
        visible={isSecurityModalOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                AUTHENTICATED SESSION
              </Text>
              <Text className="text-base font-bold text-white">
                Change Password
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close security modal"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsSecurityModalOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            <View className="mb-4 flex-row items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <Ionicons name="shield-checkmark" size={16} color="#34d399" />
              <Text className="text-xs text-zinc-200">
                Identity verified. Active session valid for today.
              </Text>
            </View>

            <View className="gap-3">
              <View>
                <Text className="text-xs font-semibold text-zinc-300">
                  Current Password
                </Text>
                <TextInput
                  secureTextEntry
                  className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                  placeholder="Enter current password"
                  placeholderTextColor="#71717a"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  style={{ fontSize: 16 }}
                />
              </View>

              <View>
                <Text className="text-xs font-semibold text-zinc-300">
                  New Password
                </Text>
                <TextInput
                  secureTextEntry
                  className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                  placeholder="Enter new secure password"
                  placeholderTextColor="#71717a"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={{ fontSize: 16 }}
                />
              </View>

              <View>
                <Text className="text-xs font-semibold text-zinc-300">
                  Confirm New Password
                </Text>
                <TextInput
                  secureTextEntry
                  className="mt-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white"
                  placeholder="Confirm new password"
                  placeholderTextColor="#71717a"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  style={{ fontSize: 16 }}
                />
              </View>

              <HapticPressable
                className="mt-4 items-center rounded-xl bg-emerald-500 py-3.5 shadow-md shadow-emerald-500/25"
                onPress={handleUpdatePassword}
              >
                <Text className="text-xs font-bold text-zinc-950">
                  Update Password
                </Text>
              </HapticPressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 4: SIGN OUT CONFIRMATION MODAL WITH ALL-DEVICES CHECKBOX */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsSignOutModalOpen(false)}
        visible={isSignOutModalOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-rose-400 uppercase">
                ACCOUNT ACTION
              </Text>
              <Text className="text-base font-bold text-white">
                Sign Out
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close sign out modal"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsSignOutModalOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <View className="flex-1 px-5 py-6 justify-between">
            <View>
              <View className="size-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 mb-4">
                <Ionicons name="log-out-outline" size={28} color="#fb7185" />
              </View>

              <Text className="text-lg font-black text-white">
                Sign out of ParlayPal?
              </Text>
              <Text className="mt-2 text-xs leading-relaxed text-zinc-400">
                You will need to enter your credentials next time you open the app. All your verified bet slips and community memberships remain securely saved to your account.
              </Text>

              {/* Checkbox: Sign out of all active devices */}
              <HapticPressable
                className="mt-6 flex-row items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3.5"
                onPress={() => setSignOutAllDevices(!signOutAllDevices)}
              >
                <Ionicons
                  name={signOutAllDevices ? "checkbox" : "square-outline"}
                  size={20}
                  color={signOutAllDevices ? "#fb7185" : "#71717a"}
                />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-white">
                    Sign out of all active devices
                  </Text>
                  <Text className="text-[10px] text-zinc-400">
                    Revoke active sessions on web and other mobile devices
                  </Text>
                </View>
              </HapticPressable>
            </View>

            <View className="gap-2.5 mb-4">
              <HapticPressable
                className="items-center rounded-xl bg-rose-500 py-3.5 shadow-md shadow-rose-500/25"
                onPress={handleConfirmSignOut}
              >
                <Text className="text-xs font-bold text-white">
                  Confirm Sign Out
                </Text>
              </HapticPressable>

              <HapticPressable
                className="items-center rounded-xl border border-zinc-800 bg-zinc-900 py-3"
                onPress={() => setIsSignOutModalOpen(false)}
              >
                <Text className="text-xs font-semibold text-zinc-400">
                  Cancel
                </Text>
              </HapticPressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* INSTAGRAM-STYLE PUBLIC BETTOR PROFILE MODAL */}
      <BettorProfileModal
        bettor={userProfileBettorData}
        visible={isPublicProfileModalOpen}
        onClose={() => setIsPublicProfileModalOpen(false)}
        onJoinCommunity={() => {
          setIsPublicProfileModalOpen(false);
          router.navigate("/(tabs)/communities");
        }}
        onEnterHub={() => {
          setIsPublicProfileModalOpen(false);
          router.navigate("/(tabs)/communities");
        }}
        onMessage={() => {
          setIsPublicProfileModalOpen(false);
          router.navigate("/(tabs)/communities");
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
