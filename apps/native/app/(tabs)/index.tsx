import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard } from "@/components/ui/glass-card";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { LegProgressRow } from "@/components/ui/leg-progress-row";
import { StatusBadge } from "@/components/ui/status-badge";
import { TicketDetailModal } from "@/components/ui/ticket-detail-modal";
import type { MobileTicket } from "@/lib/api-client";
import {
  formatCompactNumber,
  useDashboardData,
  useNotificationsData,
} from "@/lib/api-client";

export default function DashboardScreen() {
  const { data, isRefetching, refetch } = useDashboardData();
  const { data: notifications = [] } = useNotificationsData();
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const [selectedTicket, setSelectedTicket] = useState<MobileTicket | null>(
    null
  );

  const tickets = data?.tickets ?? [];
  const metrics = data?.metrics;

  const inPlayCount = metrics?.activeTicketsCount ?? 0;
  const wonCount = metrics?.cashedTicketsCount ?? 0;
  const lostCount = 6;
  const winRate = metrics?.winRatePercent ?? 68.4;

  const isLegStarted = (leg: { status: string }) =>
    leg.status === "live" || leg.status === "won" || leg.status === "lost";

  const liveTickets = tickets.filter(
    (t) =>
      t.status === "live" ||
      (t.legs?.some(isLegStarted) &&
        !t.legs?.every((l) => l.status === "won" || l.status === "lost"))
  );

  const upcomingTickets = tickets.filter(
    (t) =>
      t.status === "scheduled" ||
      (!t.legs?.some(isLegStarted) &&
        t.status !== "won" &&
        t.status !== "lost")
  );

  return (
    <SafeAreaView
      className="flex-1 bg-zinc-950"
      style={{ flex: 1, backgroundColor: "#09090b" }}
    >
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{
          paddingBottom: Platform.OS === "ios" ? 110 : 90,
          paddingTop: 12,
        }}
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor="#34d399"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Integrated Top Header with Notification Bell */}
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
              LIVE COMPANION
            </Text>
            <Text className="mt-0.5 text-2xl font-black tracking-tight text-white">
              Active Dashboard
            </Text>
            <Text className="mt-1 text-xs text-zinc-400">
              Real-time tracking of every prop, spread, and leg across all sportsbooks
            </Text>
          </View>

          {/* Top-Right Notifications Bell Button */}
          <HapticPressable
            accessibilityLabel="View notifications"
            className="relative size-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90"
            onPress={() => router.push("/notifications")}
          >
            <Ionicons name="notifications-outline" size={19} color="#e4e4e7" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 size-4 items-center justify-center rounded-full bg-emerald-500">
                <Text className="text-[9px] font-black text-zinc-950">
                  {unreadCount}
                </Text>
              </View>
            )}
          </HapticPressable>
        </View>

        {/* 4 Metric Boxes in 1 Single Row */}
        <View className="mb-5 flex-row gap-2">
          {/* 1. IN PLAY */}
          <GlassCard className="flex-1 p-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[9px] font-bold tracking-wider text-zinc-400 uppercase">
                IN PLAY
              </Text>
              <Ionicons name="flame" size={12} color="#34d399" />
            </View>
            <Text
              className="mt-1.5 font-mono text-base font-extrabold text-white"
              style={styles.tabular}
            >
              {formatCompactNumber(inPlayCount)}
            </Text>
            <Text className="mt-0.5 text-[9px] text-zinc-500">
              Active tickets
            </Text>
          </GlassCard>

          {/* 2. WON */}
          <GlassCard className="flex-1 p-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[9px] font-bold tracking-wider text-zinc-400 uppercase">
                WON
              </Text>
              <Ionicons name="checkmark-circle" size={12} color="#34d399" />
            </View>
            <Text
              className="mt-1.5 font-mono text-base font-extrabold text-emerald-400"
              style={styles.tabular}
            >
              {formatCompactNumber(wonCount)}
            </Text>
            <Text className="mt-0.5 text-[9px] text-zinc-500">
              Cashed parlays
            </Text>
          </GlassCard>

          {/* 3. LOST */}
          <GlassCard className="flex-1 p-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[9px] font-bold tracking-wider text-zinc-400 uppercase">
                LOST
              </Text>
              <Ionicons name="close-circle" size={12} color="#fb7185" />
            </View>
            <Text
              className="mt-1.5 font-mono text-base font-extrabold text-zinc-300"
              style={styles.tabular}
            >
              {formatCompactNumber(lostCount)}
            </Text>
            <Text className="mt-0.5 text-[9px] text-zinc-500">
              Settled
            </Text>
          </GlassCard>

          {/* 4. WIN RATE */}
          <GlassCard className="flex-1 p-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[9px] font-bold tracking-wider text-zinc-400 uppercase">
                WIN RATE
              </Text>
              <Ionicons name="trending-up" size={12} color="#34d399" />
            </View>
            <Text
              className="mt-1.5 font-mono text-base font-extrabold text-emerald-400"
              style={styles.tabular}
            >
              {winRate ? `${winRate.toFixed(0)}%` : "—"}
            </Text>
            <Text className="mt-0.5 text-[9px] text-zinc-500">
              Hit rate
            </Text>
          </GlassCard>
        </View>

        {/* Live & In-Play Parlays Header */}
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-bold tracking-wider text-white uppercase">
              LIVE & IN-PLAY PARLAYS
            </Text>
            <View className="rounded-full bg-emerald-500/20 px-2 py-0.5">
              <Text className="font-mono text-[10px] font-bold text-emerald-400">
                {liveTickets.length}
              </Text>
            </View>
          </View>

          <HapticPressable
            className="flex-row items-center gap-1"
            onPress={() => router.navigate("/(tabs)/tickets")}
          >
            <Text className="text-xs font-semibold text-zinc-400">
              View All
            </Text>
            <Ionicons name="arrow-forward" size={12} color="#a1a1aa" />
          </HapticPressable>
        </View>

        {/* Horizontal Scrolling Live Tickets */}
        {liveTickets.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 8 }}
          >
            {liveTickets.map((ticket) => {
              const legs = ticket.legs ?? [];
              const wonLegs = legs.filter((l) => l.status === "won").length;
              const liveLegs = legs.filter((l) => l.status === "live");
              const previewLegs = legs.slice(0, 2);

              return (
                <HapticPressable
                  key={ticket.id}
                  style={{ width: 295 }}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedTicket(ticket);
                  }}
                >
                  <GlassCard className="p-4" variant="accent">
                    {/* Top Row: Sportsbook & Live Badge */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-bold text-white">
                          {ticket.sourceName}
                        </Text>
                        <View className="rounded bg-zinc-800 px-1.5 py-0.5">
                          <Text className="font-mono text-[9px] font-bold text-zinc-300 uppercase">
                            {ticket.ticketType}
                          </Text>
                        </View>
                      </View>
                      <StatusBadge status="live" />
                    </View>

                    {/* Matchup */}
                    <Text className="mt-1 text-xs font-semibold text-zinc-200" numberOfLines={1}>
                      {ticket.sportsEvent}
                    </Text>

                    {/* Progress Segmented Bar */}
                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="font-mono text-[11px] text-zinc-400">
                        {wonLegs}/{legs.length} Legs Settled
                      </Text>
                      {liveLegs.length > 0 && (
                        <Text className="font-mono text-[10px] text-emerald-400">
                          {liveLegs.length} In Progress
                        </Text>
                      )}
                    </View>

                    <View className="my-2 flex-row gap-1">
                      {legs.map((leg) => {
                        let barColor = "bg-zinc-800";
                        if (leg.status === "won") barColor = "bg-emerald-400";
                        if (leg.status === "lost") barColor = "bg-rose-500";
                        if (leg.status === "live") barColor = "bg-amber-400";

                        return (
                          <View
                            key={leg.id}
                            className={`h-1.5 flex-1 rounded-full ${barColor}`}
                          />
                        );
                      })}
                    </View>

                    {/* Compact Key Leg Previews */}
                    <View className="mt-1 space-y-1.5 border-t border-zinc-800/80 pt-2">
                      {previewLegs.map((leg) => (
                        <View
                          key={leg.id}
                          className="flex-row items-center justify-between"
                        >
                          <Text
                            className="flex-1 text-[11px] font-medium text-zinc-300"
                            numberOfLines={1}
                          >
                            {leg.subjectName} · {leg.marketDescription}
                          </Text>
                          <View
                            className={`rounded px-1.5 py-0.5 ${
                              leg.status === "won"
                                ? "bg-emerald-500/20"
                                : leg.status === "live"
                                  ? "bg-amber-500/20"
                                  : "bg-zinc-800"
                            }`}
                          >
                            <Text
                              className={`font-mono text-[9px] font-bold uppercase ${
                                leg.status === "won"
                                  ? "text-emerald-400"
                                  : leg.status === "live"
                                    ? "text-amber-400"
                                    : "text-zinc-400"
                              }`}
                            >
                              {leg.status === "won"
                                ? "WON"
                                : leg.status === "live"
                                  ? `${leg.currentValue}/${leg.targetValue}`
                                  : "PENDING"}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Bottom Tap Prompt */}
                    <View className="mt-3 flex-row items-center justify-between border-t border-zinc-800/80 pt-2">
                      <Text className="text-[11px] font-bold text-emerald-400">
                        Inspect Live Legs
                      </Text>
                      <Ionicons name="arrow-forward" size={12} color="#34d399" />
                    </View>
                  </GlassCard>
                </HapticPressable>
              );
            })}
          </ScrollView>
        ) : (
          /* Empty State Matching */
          <View className="items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-8 text-center">
            <Ionicons name="time-outline" size={24} color="#a1a1aa" />
            <Text className="mt-2 text-sm font-bold text-white">
              No active live parlays
            </Text>
            <Text className="mt-1 text-center text-xs text-zinc-400">
              Live tracking activates automatically once games tip off.
            </Text>
          </View>
        )}

        {/* UPCOMING PARLAYS SECTION */}
        <View className="mt-6 mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-bold tracking-wider text-white uppercase">
              UPCOMING PARLAYS & SLIPS
            </Text>
            <View className="rounded-full bg-zinc-800 px-2 py-0.5">
              <Text className="font-mono text-[10px] font-bold text-zinc-300">
                {upcomingTickets.length}
              </Text>
            </View>
          </View>
        </View>

        <Text className="mb-3 text-[11px] text-zinc-400">
          Scheduled games · Live tracking activates when first leg starts
        </Text>

        {upcomingTickets.length > 0 ? (
          <View className="gap-3">
            {upcomingTickets.map((ticket) => {
              const legs = ticket.legs ?? [];
              const previewNames = legs
                .map((l) => l.subjectName)
                .slice(0, 3)
                .join(", ");

              return (
                <HapticPressable
                  key={ticket.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedTicket(ticket);
                  }}
                >
                  <GlassCard className="p-4">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-bold text-white">
                            {ticket.sourceName}
                          </Text>
                          <View className="rounded bg-zinc-800 px-1.5 py-0.5">
                            <Text className="font-mono text-[9px] font-bold text-zinc-300 uppercase">
                              {ticket.ticketType}
                            </Text>
                          </View>
                        </View>
                        <Text className="mt-0.5 text-xs text-zinc-300">
                          {ticket.sportsEvent}
                        </Text>
                      </View>

                      <View className="rounded-full border border-zinc-700 bg-zinc-800/80 px-2.5 py-1">
                        <Text className="font-mono text-[10px] font-bold text-zinc-300 uppercase">
                          Scheduled
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between border-t border-zinc-800/80 pt-2.5">
                      <Text
                        className="flex-1 text-[11px] text-zinc-400"
                        numberOfLines={1}
                      >
                        {legs.length} Legs: {previewNames}
                      </Text>
                      <View className="ml-2 flex-row items-center gap-1">
                        <Text className="text-xs font-bold text-emerald-400">
                          Inspect Slip
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={13}
                          color="#34d399"
                        />
                      </View>
                    </View>
                  </GlassCard>
                </HapticPressable>
              );
            })}
          </View>
        ) : (
          <View className="items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-6 text-center">
            <Text className="text-xs text-zinc-400">
              No scheduled upcoming slips
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Ticket ID Detail Page Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        visible={selectedTicket !== null}
        onClose={() => setSelectedTicket(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  spin: {
    transform: [{ rotate: "45deg" }],
  },
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
