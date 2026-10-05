import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { TicketDetailModal } from "@/components/ui/ticket-detail-modal";
import type { MobileTicket } from "@/lib/api-client";

export interface BettorProfileData {
  avatar: string;
  bio: string;
  followersCount: string;
  followingCount?: string;
  handle: string;
  hitRate: string;
  id: string;
  isFollowing?: boolean;
  isVerified?: boolean;
  name: string;
  slipsCount: number;
  socialProof?: {
    avatarInitials: string[];
    followedByText: string;
  };
  specialty?: string;
  syndicateHub?: {
    description: string;
    id: string;
    membersCount: string;
    name: string;
  };
  tags?: string[];
  tickets: MobileTicket[];
}

export interface BettorProfileModalProps {
  bettor: BettorProfileData | null;
  onClose: () => void;
  onEnterHub?: (hubId: string) => void;
  onJoinCommunity?: (hubId: string) => void;
  onMessage?: (bettor: BettorProfileData) => void;
  visible: boolean;
}

type ProfileTab = "won" | "lost";

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PADDING = 16;
const GRID_GAP = 6;
const TILE_SIZE = Math.floor((SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * 2) / 3);

export function BettorProfileModal({
  bettor,
  onClose,
  onEnterHub,
  onJoinCommunity,
  onMessage,
  visible,
}: BettorProfileModalProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("won");
  const [isFollowing, setIsFollowing] = useState(bettor?.isFollowing ?? false);
  const [selectedTicket, setSelectedTicket] = useState<MobileTicket | null>(null);

  if (!bettor) return null;

  const tickets = bettor.tickets ?? [];
  const wonTickets = tickets.filter((t) => t.status === "won");
  const lostTickets = tickets.filter((t) => t.status === "lost");
  const displayedTickets = activeTab === "won" ? wonTickets : lostTickets;

  const handleToggleFollow = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsFollowing((prev) => !prev);
  };

  const handleShareProfile = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Check out @${bettor.handle}'s verified betting profile on ParlayPal: ${bettor.hitRate} Hit Rate across ${bettor.slipsCount} slips! https://myparlaypal.com/u/${bettor.handle}`,
        title: `@${bettor.handle} on ParlayPal`,
      });
    } catch {
      // Ignored
    }
  };

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      visible={visible}
    >
      <SafeAreaView
        className="flex-1 bg-zinc-950"
        style={{ backgroundColor: "#09090b", flex: 1 }}
      >
        {/* TOP INSTAGRAM-STYLE APP BAR */}
        <View className="flex-row items-center justify-between border-b border-zinc-800/80 px-4 py-3">
          <HapticPressable
            accessibilityLabel="Close profile"
            className="size-8 items-center justify-center rounded-full bg-zinc-900"
            onPress={onClose}
          >
            <Ionicons name="chevron-back" size={20} color="#e4e4e7" />
          </HapticPressable>

          {/* Bettor Handle with Verified Checkmark */}
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm font-bold tracking-tight text-white">
              @{bettor.handle}
            </Text>
            {bettor.isVerified !== false && (
              <Ionicons name="checkmark-circle" size={15} color="#34d399" />
            )}
          </View>

          {/* Right Action Icons: Notifications & Share */}
          <View className="flex-row items-center gap-1.5">
            <HapticPressable
              accessibilityLabel="Share profile"
              className="size-8 items-center justify-center rounded-full bg-zinc-900"
              onPress={handleShareProfile}
            >
              <Ionicons name="share-outline" size={16} color="#e4e4e7" />
            </HapticPressable>
            <HapticPressable
              accessibilityLabel="Close"
              className="size-8 items-center justify-center rounded-full bg-zinc-900"
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color="#a1a1aa" />
            </HapticPressable>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Platform.OS === "ios" ? 44 : 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* PROFILE SUMMARY: AVATAR & 3 STATS */}
          <View className="px-4 pt-4">
            <View className="flex-row items-center gap-5">
              {/* Avatar with Gradient Verified Ring */}
              <View className="relative size-18 items-center justify-center rounded-full border-2 border-emerald-400 bg-zinc-900 p-0.5 shadow-md shadow-emerald-500/20">
                <View className="size-full items-center justify-center rounded-full bg-zinc-900">
                  <Text className="font-mono text-xl font-black text-emerald-400">
                    {bettor.avatar}
                  </Text>
                </View>
                <View className="absolute -right-1 -bottom-1 size-5 items-center justify-center rounded-full border-2 border-zinc-950 bg-emerald-500">
                  <Ionicons name="checkmark" size={11} color="#09090b" />
                </View>
              </View>

              {/* 3 Horizontal Stats Counters (Instagram Signature) */}
              <View className="flex-1 flex-row items-center justify-around">
                <View className="items-center">
                  <Text
                    className="font-mono text-base font-black text-white"
                    style={styles.tabular}
                  >
                    {bettor.slipsCount}
                  </Text>
                  <Text className="text-[11px] text-zinc-400">Slips</Text>
                </View>

                <View className="items-center">
                  <Text
                    className="font-mono text-base font-black text-emerald-400"
                    style={styles.tabular}
                  >
                    {bettor.hitRate}
                  </Text>
                  <Text className="text-[11px] text-zinc-400">Hit Rate</Text>
                </View>

                <View className="items-center">
                  <Text
                    className="font-mono text-base font-black text-white"
                    style={styles.tabular}
                  >
                    {bettor.followersCount}
                  </Text>
                  <Text className="text-[11px] text-zinc-400">Followers</Text>
                </View>
              </View>
            </View>

            {/* BIO DETAILS & METADATA */}
            <View className="mt-3">
              <Text className="text-sm font-black text-white">
                {bettor.name}
              </Text>
              {bettor.specialty && (
                <Text className="text-[11px] font-semibold text-emerald-400">
                  {bettor.specialty}
                </Text>
              )}
              <Text className="mt-1 text-xs leading-relaxed text-zinc-300">
                {bettor.bio}
              </Text>

              {/* Link */}
              <View className="mt-1.5 flex-row items-center gap-1">
                <Ionicons name="link-outline" size={12} color="#34d399" />
                <Text className="text-xs font-semibold text-emerald-400">
                  myparlaypal.com/u/{bettor.handle}
                </Text>
              </View>

              {/* Tag Chips */}
              {Boolean(bettor.tags?.length) && (
                <View className="mt-2.5 flex-row flex-wrap gap-1.5">
                  {bettor.tags?.map((tag) => (
                    <View
                      key={tag}
                      className="rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-0.5"
                    >
                      <Text className="text-[10px] font-medium text-zinc-300">
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Social Proof (Followed by...) */}
              <View className="mt-3 flex-row items-center gap-2">
                <View className="flex-row">
                  {(bettor.socialProof?.avatarInitials ?? ["MR", "SC", "GG"]).map(
                    (init, idx) => (
                      <View
                        key={`sp_${init}_${idx}`}
                        className={`size-5 items-center justify-center rounded-full border border-zinc-950 bg-zinc-800 ${
                          idx > 0 ? "-ml-1.5" : ""
                        }`}
                      >
                        <Text className="font-mono text-[8px] font-bold text-zinc-300">
                          {init}
                        </Text>
                      </View>
                    )
                  )}
                </View>
                <Text
                  className="flex-1 text-[11px] text-zinc-400"
                  numberOfLines={1}
                >
                  {bettor.socialProof?.followedByText ??
                    "Followed by marcus_prop, baller_jay and 42 others"}
                </Text>
              </View>
            </View>

            {/* ACTION BUTTONS: FOLLOW & JOIN COMMUNITY (NO ENTER HUB / MESSAGE) */}
            <View className="mt-4 flex-row items-center gap-2.5">
              <HapticPressable
                accessibilityLabel={isFollowing ? "Unfollow" : "Follow"}
                className={`flex-1 items-center justify-center rounded-xl py-2.5 ${
                  isFollowing
                    ? "border border-zinc-700 bg-zinc-800/90"
                    : "bg-emerald-500 shadow-md shadow-emerald-500/25"
                }`}
                onPress={handleToggleFollow}
              >
                <Text
                  className={`text-xs font-bold ${
                    isFollowing ? "text-emerald-400" : "text-zinc-950"
                  }`}
                >
                  {isFollowing ? "Following ✓" : "Follow"}
                </Text>
              </HapticPressable>

              <HapticPressable
                accessibilityLabel="Join community"
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2.5"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  const hubId = bettor.syndicateHub?.id ?? "sharp-edge";
                  onJoinCommunity?.(hubId);
                  onEnterHub?.(hubId);
                }}
              >
                <Ionicons name="people-outline" size={15} color="#34d399" />
                <Text className="text-xs font-bold text-emerald-400">
                  Join Community
                </Text>
              </HapticPressable>
            </View>
          </View>

          {/* INSTAGRAM TABS BAR: WINS & LOSSES ONLY */}
          <View className="mt-5 flex-row items-center border-t border-b border-zinc-800 bg-zinc-950">
            <HapticPressable
              accessibilityLabel="Winning tickets"
              className={`flex-1 flex-row items-center justify-center gap-2 py-3 border-b-2 ${
                activeTab === "won" ? "border-emerald-400 bg-emerald-500/5" : "border-transparent"
              }`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab("won");
              }}
            >
              <Ionicons
                name="trophy"
                size={16}
                color={activeTab === "won" ? "#34d399" : "#71717a"}
              />
              <Text
                className={`text-xs font-bold ${
                  activeTab === "won" ? "text-emerald-400" : "text-zinc-400"
                }`}
              >
                Wins ({wonTickets.length})
              </Text>
            </HapticPressable>

            <HapticPressable
              accessibilityLabel="Losing tickets"
              className={`flex-1 flex-row items-center justify-center gap-2 py-3 border-b-2 ${
                activeTab === "lost" ? "border-rose-400 bg-rose-500/5" : "border-transparent"
              }`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab("lost");
              }}
            >
              <Ionicons
                name="close-circle-outline"
                size={16}
                color={activeTab === "lost" ? "#fb7185" : "#71717a"}
              />
              <Text
                className={`text-xs font-bold ${
                  activeTab === "lost" ? "text-rose-400" : "text-zinc-400"
                }`}
              >
                Losses ({lostTickets.length})
              </Text>
            </HapticPressable>
          </View>

          {/* 3-COLUMN TICKET GRID (INSTAGRAM PHOTO GRID REPLICA) */}
          <View className="px-4 pt-3">
            {displayedTickets.length === 0 ? (
              <View className="items-center justify-center py-12">
                <Ionicons name="receipt-outline" size={32} color="#52525b" />
                <Text className="mt-2 text-xs font-semibold text-zinc-400">
                  No {activeTab === "won" ? "winning" : "losing"} slips tracked yet
                </Text>
                <Text className="mt-0.5 text-[10px] text-zinc-500">
                  Verified slips will appear here once settled
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: GRID_GAP,
                }}
              >
                {displayedTickets.map((ticket) => {
                  const legs = ticket.legs ?? [];
                  const wonCount = legs.filter((l) => l.status === "won").length;
                  const isWon = ticket.status === "won";
                  const statusColor = isWon ? "#34d399" : "#fb7185";

                  return (
                    <HapticPressable
                      key={ticket.id}
                      accessibilityLabel={`View slip ${ticket.sportsEvent}`}
                      style={{
                        height: TILE_SIZE,
                        width: TILE_SIZE,
                      }}
                      className={`overflow-hidden rounded-xl border p-2 justify-between ${
                        isWon
                          ? "border-emerald-500/30 bg-zinc-900/95"
                          : "border-rose-500/30 bg-zinc-900/95"
                      }`}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setSelectedTicket(ticket);
                      }}
                    >
                      {/* Top Header inside tile: Sportsbook & Status Badge */}
                      <View className="flex-row items-center justify-between">
                        <View className="rounded bg-zinc-800 px-1 py-0.5">
                          <Text className="font-mono text-[8px] font-bold text-zinc-300">
                            {ticket.sourceName?.slice(0, 3).toUpperCase() ?? "BET"}
                          </Text>
                        </View>
                        <View
                          className="rounded-full px-1.5 py-0.2"
                          style={{
                            backgroundColor: isWon ? "rgba(52, 211, 153, 0.15)" : "rgba(251, 113, 133, 0.15)",
                          }}
                        >
                          <Text
                            className="font-mono text-[8px] font-black uppercase"
                            style={{ color: statusColor }}
                          >
                            {isWon ? "WON ✓" : "LOST ✕"}
                          </Text>
                        </View>
                      </View>

                      {/* Middle: Leg count & event title preview */}
                      <View className="my-1">
                        <Text className="font-mono text-[10px] font-bold text-white">
                          {legs.length} Legs
                        </Text>
                        <Text
                          className="text-[9px] text-zinc-400"
                          numberOfLines={2}
                        >
                          {ticket.sportsEvent}
                        </Text>
                      </View>

                      {/* Bottom Footer: Hit Count & View Legs Hint */}
                      <View className="border-t border-zinc-800/60 pt-1">
                        <View className="flex-row items-center justify-between">
                          <Text
                            className="font-mono text-[9px] font-bold"
                            style={{ color: statusColor }}
                          >
                            {isWon
                              ? `${legs.length}/${legs.length} Hit`
                              : `${wonCount}/${legs.length} Hit`}
                          </Text>
                          <Text className="text-[8px] font-semibold text-zinc-500">
                            Legs ›
                          </Text>
                        </View>
                      </View>
                    </HapticPressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* TICKET DETAIL SHEET */}
        <TicketDetailModal
          ticket={selectedTicket}
          visible={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
