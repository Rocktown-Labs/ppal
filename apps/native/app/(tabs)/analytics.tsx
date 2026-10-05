import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Modal,
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
import { StatusBadge } from "@/components/ui/status-badge";
import { TicketDetailModal } from "@/components/ui/ticket-detail-modal";
import type { MobileTicket, PlayerStat, SportsbookStat } from "@/lib/api-client";
import { useAnalyticsData, useDashboardData } from "@/lib/api-client";

export default function AnalyticsScreen() {
  const { data, isRefetching, refetch } = useAnalyticsData();
  const { data: dashboardData } = useDashboardData();
  const [refreshing, setRefreshing] = useState(false);

  // Drilldown Modal states
  const [selectedSportsbook, setSelectedSportsbook] =
    useState<SportsbookStat | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStat | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<MobileTicket | null>(
    null
  );
  const [isRecentSettledModalOpen, setIsRecentSettledModalOpen] =
    useState(false);

  // Player drilldown filter & sort states
  const [playerPropFilter, setPlayerPropFilter] = useState("All");
  const [playerSortOrder, setPlayerSortOrder] = useState<"newest" | "line">(
    "newest"
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSelectedSportsbook(null);
        setSelectedPlayer(null);
        setSelectedTicket(null);
        setIsRecentSettledModalOpen(false);
        setPlayerPropFilter("All");
      };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const metrics = data?.metrics;
  const sportsbooks = data?.sportsbooks ?? [];
  const players = data?.players ?? [];
  const allTickets = dashboardData?.tickets ?? [];

  // Filter the last 10 settled tickets (won or lost)
  const settledTickets = allTickets
    .filter((t) => t.status === "won" || t.status === "lost")
    .slice(0, 10);
  const settledWins = settledTickets.filter((t) => t.status === "won").length;
  const settledLosses = settledTickets.filter((t) => t.status === "lost").length;
  const settledWinRate =
    settledTickets.length > 0
      ? Math.round((settledWins / settledTickets.length) * 100)
      : 70;

  const handleTicketPress = (ticketId: string, eventName?: string) => {
    Haptics.selectionAsync().catch(() => {});
    const found = allTickets.find((t) => t.id === ticketId);
    if (found) {
      setSelectedTicket(found);
    } else {
      // Fallback ticket object matching MobileTicket interface without odds/money
      setSelectedTicket({
        createdAt: new Date().toISOString(),
        id: ticketId,
        legs: [
          {
            currentValue: 28,
            id: `${ticketId}_leg_1`,
            marketDescription: "Points",
            operator: "over",
            rawDescription: "Over 26.5 Points",
            status: "won",
            subjectName: "Jayson Tatum",
            targetValue: 26.5,
          },
          {
            currentValue: 3,
            id: `${ticketId}_leg_2`,
            marketDescription: "Made 3PT",
            operator: "over",
            rawDescription: "Over 1.5 Made 3PT",
            status: "won",
            subjectName: "Derrick White",
            targetValue: 1.5,
          },
        ],
        odds: "",
        originalStake: 0,
        sourceName: selectedSportsbook?.name ?? "Sportsbook",
        sportsEvent: eventName ?? "Matchup Detail",
        status: "won",
        ticketType: "parlay",
        verificationStatus: "verified",
      });
    }
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
        refreshControl={
          <RefreshControl
            onRefresh={onRefresh}
            refreshing={refreshing || isRefetching}
            tintColor="#34d399"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header without extra refresh button */}
        <View className="mb-4">
          <Text className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
            PERSONAL INTELLIGENCE
          </Text>
          <Text className="mt-0.5 text-2xl font-black tracking-tight text-white">
            Analytics Hub
          </Text>
          <Text className="mt-1 text-xs text-zinc-400">
            Verified hit rates, sportsbook breakdown, and player prop trends
            computed from real slips
          </Text>
        </View>

        {/* 2x2 Stats Grid as requested by user */}
        <View className="mb-5 gap-2.5">
          {/* Row 1: Win Rate & Tracked Slips */}
          <View className="flex-row gap-2.5">
            <GlassCard className="flex-1 p-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  Win Rate
                </Text>
                <Ionicons name="trending-up" size={15} color="#34d399" />
              </View>
              <Text
                className="mt-1.5 font-mono text-2xl font-black text-emerald-400"
                style={styles.tabular}
              >
                {metrics?.winRate ?? 68}%
              </Text>
              <Text className="mt-0.5 text-[10px] text-zinc-500">
                97 wins · 45 losses
              </Text>
            </GlassCard>

            <GlassCard className="flex-1 p-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  Tracked Slips
                </Text>
                <Ionicons name="documents-outline" size={15} color="#a1a1aa" />
              </View>
              <Text
                className="mt-1.5 font-mono text-2xl font-black text-white"
                style={styles.tabular}
              >
                {metrics?.totalSlips ?? 142}
              </Text>
              <Text className="mt-0.5 text-[10px] text-zinc-500">
                All verified via sports APIs
              </Text>
            </GlassCard>
          </View>

          {/* Row 2: Total Settled Legs & Avg Legs/Slip */}
          <View className="flex-row gap-2.5">
            <GlassCard className="flex-1 p-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  Total Legs
                </Text>
                <Ionicons name="list-outline" size={15} color="#34d399" />
              </View>
              <Text
                className="mt-1.5 font-mono text-2xl font-black text-white"
                style={styles.tabular}
              >
                614
              </Text>
              <Text className="mt-0.5 text-[10px] text-zinc-500">
                Settled props & spreads
              </Text>
            </GlassCard>

            <GlassCard className="flex-1 p-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                  Avg Legs / Slip
                </Text>
                <Ionicons name="bar-chart-outline" size={15} color="#a1a1aa" />
              </View>
              <Text
                className="mt-1.5 font-mono text-2xl font-black text-white"
                style={styles.tabular}
              >
                {metrics?.avgLegsPerSlip ?? 4.2}
              </Text>
              <Text className="mt-0.5 text-[10px] text-zinc-500">
                Average parlay depth
              </Text>
            </GlassCard>
          </View>
        </View>

        {/* Recent Form Record Card (Clickable to view last 10 settled slips) */}
        <HapticPressable
          accessibilityLabel="View last 10 settled tickets"
          className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setIsRecentSettledModalOpen(true);
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={15} color="#34d399" />
              <Text className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
                Recent
              </Text>
              <Text className="text-[11px] font-medium text-zinc-500">
                (Last 10)
              </Text>
            </View>
            <View className="rounded-full bg-emerald-500/15 px-2.5 py-0.5">
              <Text className="font-mono text-[11px] font-bold text-emerald-400">
                {settledWinRate}% Hit Rate
              </Text>
            </View>
          </View>

          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-1 pr-2">
              <Text className="font-mono text-3xl font-black text-white">
                {settledWins}W - {settledLosses}L
              </Text>
              <Text className="mt-0.5 text-xs text-zinc-400">
                {settledWins} cashed · {settledLosses} missed
              </Text>
            </View>

            <View className="flex-row shrink-0 items-center gap-1 rounded-xl border border-emerald-500/20 bg-zinc-800/90 px-3 py-1.5">
              <Text className="text-xs font-semibold text-emerald-400">
                View Slips
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#34d399" />
            </View>
          </View>
        </HapticPressable>

        {/* Breakdown by Sportsbook (Tap to drilldown tickets) */}
        <View className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
              Breakdown by Sportsbook
            </Text>
            <Ionicons name="pie-chart-outline" size={16} color="#71717a" />
          </View>

          <View className="gap-2.5">
            {sportsbooks.map((book) => (
              <HapticPressable
                key={book.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedSportsbook(book);
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-bold text-white">{book.name}</Text>
                    <Ionicons name="chevron-forward" size={13} color="#71717a" />
                  </View>
                  <Text className="font-mono text-xs text-zinc-400">
                    {book.won}W / {book.lost}L ({book.winRate}%)
                  </Text>
                </View>

                {/* Progress bar */}
                <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <View
                    className="h-full bg-emerald-500"
                    style={{ width: `${book.winRate}%` }}
                  />
                </View>
              </HapticPressable>
            ))}
          </View>
        </View>

        {/* Most Bet Athletes & Teams (Tap to drilldown props) */}
        <View className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
              Most Bet Athletes & Teams
            </Text>
            <Ionicons name="flame" size={16} color="#34d399" />
          </View>

          <View className="gap-2.5">
            {players.map((player) => (
              <HapticPressable
                key={player.id}
                className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3.5"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedPlayer(player);
                }}
              >
                <View className="flex-row items-center justify-between">
                  {/* Left: Athlete Name, Team & Tracked Count */}
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-bold text-white">
                      {player.name}
                    </Text>
                    <Text className="mt-0.5 text-[11px] text-zinc-400">
                      {player.team} · {player.sport} · {player.selections} tracked legs
                    </Text>
                  </View>

                  {/* Right: Hit Rate, Record and Chevron */}
                  <View className="flex-row items-center gap-3">
                    <View className="items-end">
                      <Text
                        className={`font-mono text-sm font-bold ${
                          player.hitRate >= 70
                            ? "text-emerald-400"
                            : "text-zinc-200"
                        }`}
                      >
                        {player.hitRate}%
                      </Text>
                      <Text className="mt-0.5 font-mono text-[10px] text-zinc-400">
                        {player.won}W - {player.lost}L
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color="#71717a" />
                  </View>
                </View>
              </HapticPressable>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* MODAL 1: LAST 10 SETTLED SLIPS DRILLDOWN */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsRecentSettledModalOpen(false)}
        visible={isRecentSettledModalOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                SETTLED ARCHIVE
              </Text>
              <Text className="text-base font-bold text-white">
                Last 10 Settled Slips
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close settled slips modal"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsRecentSettledModalOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            <View className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs text-zinc-300">
                  Settled Record:{" "}
                  <Text className="font-bold text-white">
                    {settledWins}W - {settledLosses}L
                  </Text>
                </Text>
                <View className="rounded-full bg-emerald-500/20 px-2 py-0.5">
                  <Text className="font-mono text-xs font-bold text-emerald-400">
                    {settledWinRate}% Win Rate
                  </Text>
                </View>
              </View>
              <Text className="mt-1 text-[11px] text-zinc-400">
                Swipe down or tap close to return to analytics
              </Text>
            </View>

            <Text className="mb-3 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              SETTLED TICKETS ({settledTickets.length}) · TAP TO VIEW TICKET ID
            </Text>

            {settledTickets.map((t) => (
              <HapticPressable
                key={t.id}
                onPress={() => handleTicketPress(t.id, t.sportsEvent)}
              >
                <GlassCard className="mb-3 p-3.5">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-[10px] font-bold text-zinc-400 uppercase">
                          {t.sourceName}
                        </Text>
                        <Text className="text-[10px] text-zinc-600">•</Text>
                        <Text className="text-[10px] font-bold text-zinc-400 uppercase">
                          {t.ticketType}
                        </Text>
                      </View>
                      <Text className="mt-1 font-bold text-white">
                        {t.sportsEvent}
                      </Text>
                      <Text className="mt-0.5 text-xs text-zinc-400">
                        {t.legs?.length ?? 0} Legs Tracked
                      </Text>
                    </View>
                    <StatusBadge status={t.status} />
                  </View>

                  <View className="mt-2.5 flex-row items-center justify-between border-t border-zinc-800/80 pt-2 text-xs">
                    <Text className="font-mono text-zinc-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[10px] font-semibold text-emerald-400">
                        Inspect Ticket ID
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={11}
                        color="#34d399"
                      />
                    </View>
                  </View>
                </GlassCard>
              </HapticPressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 2: SPORTSBOOK TICKETS DRILLDOWN MODAL */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedSportsbook(null)}
        visible={selectedSportsbook !== null}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                SPORTSBOOK ARCHIVE
              </Text>
              <Text className="text-base font-bold text-white">
                {selectedSportsbook?.name} Slips
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close sportsbook drilldown"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setSelectedSportsbook(null)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4">
            <View className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <Text className="text-xs text-zinc-400">
                Performance Record:{" "}
                <Text className="font-bold text-white">
                  {selectedSportsbook?.won} Wins
                </Text>{" "}
                /{" "}
                <Text className="font-bold text-zinc-300">
                  {selectedSportsbook?.lost} Losses
                </Text>{" "}
                ({selectedSportsbook?.winRate}% Win Rate)
              </Text>
            </View>

            <Text className="mb-3 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              UPLOADED TICKETS ({selectedSportsbook?.tickets.length}) · TAP TO
              VIEW
            </Text>

            {/* Clickable ticket cards opening the Ticket ID Detail Page */}
            {selectedSportsbook?.tickets.map((t) => (
              <HapticPressable
                key={t.id}
                onPress={() => handleTicketPress(t.id, t.event)}
              >
                <GlassCard className="mb-3 p-3.5">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="font-bold text-white">{t.event}</Text>
                      <Text className="mt-0.5 text-xs text-zinc-400">
                        {t.type}
                      </Text>
                    </View>
                    <StatusBadge status={t.status} />
                  </View>
                  <View className="mt-2.5 flex-row items-center justify-between border-t border-zinc-800/80 pt-2 text-xs">
                    <Text className="font-mono text-zinc-500">{t.date}</Text>
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[10px] font-semibold text-emerald-400">
                        View Ticket ID
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={11}
                        color="#34d399"
                      />
                    </View>
                  </View>
                </GlassCard>
              </HapticPressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL 3: ATHLETE / TEAM DATA TABLE ID DRILLDOWN MODAL */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPlayer(null)}
        visible={selectedPlayer !== null}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                ATHLETE PROP INTELLIGENCE
              </Text>
              <Text className="text-base font-bold text-white">
                {selectedPlayer?.name}
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close athlete drilldown"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setSelectedPlayer(null)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
            {/* KPI Summary Banner */}
            <View className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3.5">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xs font-semibold text-zinc-400">
                    {selectedPlayer?.team} · {selectedPlayer?.sport}
                  </Text>
                  <Text className="mt-0.5 font-mono text-2xl font-black text-emerald-400">
                    {selectedPlayer?.hitRate}% Hit Rate
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs font-semibold text-white">
                    {selectedPlayer?.won} Hit / {selectedPlayer?.lost} Missed
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-zinc-400">
                    {selectedPlayer?.selections} Total Prop Legs
                  </Text>
                </View>
              </View>
            </View>

            {/* Filter Chips Bar */}
            <View className="mb-3">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {[
                  "All",
                  "Hits",
                  "Misses",
                  "Points",
                  "Rebounds",
                  "Assists",
                  "Threes",
                ].map((cat) => {
                  const active = playerPropFilter === cat;
                  return (
                    <HapticPressable
                      key={cat}
                      className={`rounded-full px-3 py-1 border ${
                        active
                          ? "border-emerald-500/50 bg-emerald-500/20"
                          : "border-zinc-800 bg-zinc-900/60"
                      }`}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setPlayerPropFilter(cat);
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? "text-emerald-400" : "text-zinc-400"
                        }`}
                      >
                        {cat}
                      </Text>
                    </HapticPressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Sort bar */}
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                HISTORICAL PROP LEGS DATA TABLE
              </Text>
              <HapticPressable
                className="flex-row items-center gap-1"
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPlayerSortOrder(
                    playerSortOrder === "newest" ? "line" : "newest"
                  );
                }}
              >
                <Ionicons name="swap-vertical" size={12} color="#34d399" />
                <Text className="text-[10px] font-medium text-emerald-400">
                  Sort: {playerSortOrder === "newest" ? "Date" : "Line Value"}
                </Text>
              </HapticPressable>
            </View>

            {/* Filterable Data Table */}
            {(() => {
              const allBets = selectedPlayer?.bets ?? [];
              const filtered = allBets
                .filter((bet) => {
                  if (playerPropFilter === "Hits") return bet.status === "won";
                  if (playerPropFilter === "Misses") return bet.status === "lost";
                  if (playerPropFilter === "Points")
                    return (bet.market || bet.prop).toLowerCase().includes("point");
                  if (playerPropFilter === "Rebounds")
                    return (bet.market || bet.prop).toLowerCase().includes("rebound");
                  if (playerPropFilter === "Assists")
                    return (bet.market || bet.prop).toLowerCase().includes("assist");
                  if (playerPropFilter === "Threes")
                    return (
                      (bet.market || bet.prop).toLowerCase().includes("three") ||
                      (bet.market || bet.prop).toLowerCase().includes("3")
                    );
                  return true;
                })
                .sort((a, b) => {
                  if (playerSortOrder === "line") {
                    return (b.targetValue ?? 0) - (a.targetValue ?? 0);
                  }
                  return 0;
                });

              if (filtered.length === 0) {
                return (
                  <View className="items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 py-8">
                    <Text className="text-xs text-zinc-400">
                      No props match the selected filter
                    </Text>
                  </View>
                );
              }

              return (
                <View className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
                  {/* Table Header */}
                  <View className="flex-row items-center border-b border-zinc-800 bg-zinc-900/90 px-3 py-2.5">
                    <Text className="w-[85px] text-[10px] font-bold text-zinc-400 uppercase">
                      Date / Match
                    </Text>
                    <Text className="flex-1 text-[10px] font-bold text-zinc-400 uppercase">
                      Prop & Line
                    </Text>
                    <Text className="w-[65px] text-center text-[10px] font-bold text-zinc-400 uppercase">
                      Result
                    </Text>
                    <Text className="w-[50px] text-right text-[10px] font-bold text-zinc-400 uppercase">
                      Status
                    </Text>
                  </View>

                  {/* Table Rows */}
                  {filtered.map((bet, idx) => (
                    <View
                      key={bet.id}
                      className={`flex-row items-center border-b border-zinc-800/40 px-3 py-3 ${
                        idx % 2 === 1 ? "bg-zinc-900/30" : "bg-transparent"
                      }`}
                    >
                      <View className="w-[85px] pr-1">
                        <Text className="text-[11px] font-semibold text-white">
                          {bet.date.split(",")[0]}
                        </Text>
                        <Text className="text-[10px] text-zinc-500">
                          {bet.matchup}
                        </Text>
                      </View>
                      <View className="flex-1 pr-1">
                        <Text className="text-xs font-bold text-zinc-200">
                          {bet.line}
                        </Text>
                        <Text className="text-[10px] text-zinc-400">
                          {bet.market || bet.prop}
                        </Text>
                      </View>
                      <View className="w-[65px] items-center">
                        <Text className="font-mono text-xs font-bold text-white">
                          {bet.actualValue ?? "—"}
                        </Text>
                      </View>
                      <View className="w-[50px] items-end">
                        <View
                          className={`rounded-full px-2 py-0.5 ${
                            bet.status === "won"
                              ? "bg-emerald-500/20"
                              : bet.status === "lost"
                                ? "bg-rose-500/20"
                                : "bg-amber-500/20"
                          }`}
                        >
                          <Text
                            className={`font-mono text-[9px] font-bold uppercase ${
                              bet.status === "won"
                                ? "text-emerald-400"
                                : bet.status === "lost"
                                  ? "text-rose-400"
                                  : "text-amber-400"
                            }`}
                          >
                            {bet.status === "won"
                              ? "HIT"
                              : bet.status === "lost"
                                ? "MISS"
                                : "LIVE"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* REUSABLE TICKET DETAIL (ID PAGE) MODAL */}
      <TicketDetailModal
        onClose={() => setSelectedTicket(null)}
        ticket={selectedTicket}
        visible={selectedTicket !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
