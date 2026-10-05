import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard } from "@/components/ui/glass-card";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { LegProgressRow } from "@/components/ui/leg-progress-row";
import { StatusBadge } from "@/components/ui/status-badge";
import { TicketDetailModal } from "@/components/ui/ticket-detail-modal";
import type { MobileTicket } from "@/lib/api-client";
import { useDashboardData } from "@/lib/api-client";
import { useAppState } from "@/lib/app-state";

type FilterTab = "all" | "live" | "needs_review" | "scheduled" | "won" | "lost";

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "all", label: "All Slips" },
  { id: "live", label: "Live" },
  { id: "needs_review", label: "Needs Review" },
  { id: "scheduled", label: "Scheduled" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

const EXTRACTION_PHASES = [
  "Optical Character Recognition (OCR)...",
  "Resolving Player & Market Entities...",
  "Matching Official Sportsbook Feeds...",
  "Extraction 100% Verified",
];

const INITIAL_EXTRACTED_LEGS = [
  {
    confidence: "100%",
    id: "ext_1",
    line: "Over 26.5 Points",
    player: "Jayson Tatum",
    status: "won" as const,
    team: "BOS Celtics",
  },
  {
    confidence: "100%",
    id: "ext_2",
    line: "Over 1.5 Made 3PT",
    player: "Derrick White",
    status: "won" as const,
    team: "BOS Celtics",
  },
  {
    confidence: "98%",
    id: "ext_3",
    line: "Over 9.5 Assists",
    player: "Tyrese Haliburton",
    status: "live" as const,
    team: "IND Pacers",
  },
  {
    confidence: "99%",
    id: "ext_4",
    line: "Over 6.5 Rebounds",
    player: "Myles Turner",
    status: "live" as const,
    team: "IND Pacers",
  },
];

export default function TicketsScreen() {
  const { isUploadModalOpen, setIsUploadModalOpen } = useAppState();
  const { data, isRefetching, refetch } = useDashboardData();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Accordion state: closed by default until tapped
  const [expandedTickets, setExpandedTickets] = useState<
    Record<string, boolean>
  >({});

  // Ticket ID Detail Modal state
  const [selectedTicket, setSelectedTicket] = useState<MobileTicket | null>(
    null
  );

  // Upload Intake states
  const [trackingIntent, setTrackingIntent] = useState<"live" | "historical">(
    "live"
  );
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
  } | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<
    "idle" | "extracting" | "reviewed"
  >("idle");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [extractedLegs] = useState(INITIAL_EXTRACTED_LEGS);
  const [expandedLegId, setExpandedLegId] = useState<string | null>("ext_1");

  const tickets = data?.tickets ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const toggleExpand = (ticketId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setExpandedTickets((prev) => ({
      ...prev,
      [ticketId]: !prev[ticketId],
    }));
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (activeTab !== "all" && t.status !== activeTab) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesSource = t.sourceName.toLowerCase().includes(q);
        const matchesEvent = t.sportsEvent.toLowerCase().includes(q);
        const matchesLeg = t.legs?.some(
          (l) =>
            l.subjectName.toLowerCase().includes(q) ||
            l.rawDescription.toLowerCase().includes(q)
        );
        return matchesSource || matchesEvent || matchesLeg;
      }
      return true;
    });
  }, [tickets, activeTab, searchQuery]);

  const handleStartExtraction = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExtractionStatus("extracting");
    setPhaseIndex(0);

    setTimeout(() => {
      setPhaseIndex(1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 900);

    setTimeout(() => {
      setPhaseIndex(2);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 1800);

    setTimeout(async () => {
      setPhaseIndex(3);
      setExtractionStatus("reviewed");
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    }, 2700);
  };

  const handleConfirmSlip = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsUploadModalOpen(false);
    setSelectedFile(null);
    setExtractionStatus("idle");
    setPhaseIndex(0);
  };

  const handleResetModal = () => {
    setSelectedFile(null);
    setExtractionStatus("idle");
    setPhaseIndex(0);
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
        {/* Header: Title is "My Tickets" without refresh/upload buttons */}
        <View className="mb-4">
          <Text className="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
            BET HISTORY & VAULT
          </Text>
          <Text className="mt-0.5 text-2xl font-black tracking-tight text-white">
            My Tickets
          </Text>
          <Text className="mt-1 text-xs text-zinc-400">
            Archive of all uploaded slips, live tracking records, and settled
            bets
          </Text>
        </View>

        {/* Filter Pills */}
        <View className="mb-3">
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
                  className={`rounded-full px-3.5 py-1.5 ${
                    active ? "bg-zinc-800" : "bg-transparent"
                  }`}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveTab(tab.id);
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-zinc-500"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </HapticPressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Search Input Bar */}
        <View className="mb-4 flex-row items-center rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2.5">
          <Ionicons name="search" size={16} color="#71717a" />
          <TextInput
            placeholder="Search by player, team, or sportsbook..."
            placeholderTextColor="#71717a"
            className="ml-2.5 flex-1 text-xs text-white"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{ fontSize: 16 }}
          />
          {searchQuery.length > 0 && (
            <HapticPressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#71717a" />
            </HapticPressable>
          )}
        </View>

        {/* Tickets List: Condensed Cards (Closed by default until tapped) */}
        {filteredTickets.length > 0 ? (
          filteredTickets.map((ticket) => {
            const legs = ticket.legs ?? [];
            const isExpanded = expandedTickets[ticket.id] ?? false;
            const wonLegs = legs.filter((l) => l.status === "won").length;

            return (
              <GlassCard
                key={ticket.id}
                className="mb-3 overflow-hidden p-3.5"
                variant={ticket.status === "live" ? "accent" : "default"}
              >
                {/* Condensed Header Row */}
                <HapticPressable
                  className="flex-row items-start justify-between"
                  onPress={() => toggleExpand(ticket.id)}
                >
                  <View className="flex-1 pr-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-bold text-white">
                        {ticket.sourceName}
                      </Text>
                      <View className="rounded bg-zinc-800 px-1.5 py-0.5">
                        <Text className="font-mono text-[10px] font-bold text-zinc-300 uppercase">
                          {ticket.ticketType}
                        </Text>
                      </View>
                    </View>
                    <Text className="mt-0.5 text-xs text-zinc-400">
                      {ticket.sportsEvent}
                    </Text>
                  </View>

                  <View className="items-end gap-1.5">
                    <StatusBadge status={ticket.status} />
                    <View className="flex-row items-center gap-1">
                      <Text className="text-[10px] text-zinc-500">
                        {isExpanded ? "Collapse" : "Tap to expand"}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={13}
                        color="#71717a"
                      />
                    </View>
                  </View>
                </HapticPressable>

                {/* Progress / Status Summary */}
                <View className="mt-2.5 flex-row items-center justify-between border-t border-zinc-800/80 pt-2">
                  <Text className="font-mono text-[11px] text-zinc-400">
                    {wonLegs}/{legs.length} Legs Settled
                  </Text>
                  <HapticPressable
                    className="flex-row items-center gap-1"
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setSelectedTicket(ticket);
                    }}
                  >
                    <Text className="text-[10px] font-bold text-emerald-400">
                      Ticket ID Details
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={10}
                      color="#34d399"
                    />
                  </HapticPressable>
                </View>

                {/* Segmented Leg Pills */}
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

                {/* Expanded Accordion: Only shown when tapped */}
                {isExpanded && (
                  <View className="mt-2 border-t border-zinc-800/60 pt-2">
                    {legs.map((leg) => (
                      <LegProgressRow key={leg.id} leg={leg} />
                    ))}
                  </View>
                )}
              </GlassCard>
            );
          })
        ) : (
          /* Empty State */
          <View className="items-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-12 text-center">
            <View className="mb-4 size-14 items-center justify-center rounded-2xl bg-zinc-800/80">
              <Ionicons name="ticket-outline" size={28} color="#a1a1aa" />
            </View>
            <Text className="text-base font-bold text-white">
              No tickets found
            </Text>
            <Text className="mt-1 mb-5 text-center text-xs leading-relaxed text-zinc-400">
              {searchQuery
                ? `No slips match "${searchQuery}". Try clearing search.`
                : "Double-tap the Tickets icon on the bottom nav to upload a slip."}
            </Text>
            <HapticPressable
              className="flex-row items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 shadow-lg shadow-emerald-500/25"
              onPress={() => {
                setIsUploadModalOpen(true);
                handleResetModal();
              }}
            >
              <Ionicons name="add" size={18} color="#09090b" />
              <Text className="text-xs font-bold text-zinc-950">
                Upload Bet Slip
              </Text>
            </HapticPressable>
          </View>
        )}
      </ScrollView>

      {/* COMBINED UPLOAD MODAL (Opened via double tap or button) */}
      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsUploadModalOpen(false)}
        visible={isUploadModalOpen}
      >
        <SafeAreaView
          className="flex-1 bg-zinc-950"
          style={{ backgroundColor: "#09090b", flex: 1 }}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-800/80 px-4 py-3">
            <View>
              <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                AI INTAKE ENGINE
              </Text>
              <Text className="text-base font-bold text-white">
                Upload Bet Slip
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close upload modal"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => setIsUploadModalOpen(false)}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>

          <ScrollView
            className="flex-1 px-4"
            contentContainerStyle={{ paddingBottom: 40, paddingTop: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Step 1: SELECT TRACKING INTENT (Side-by-side buttons) */}
            <Text className="mb-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              SELECT TRACKING INTENT
            </Text>
            <View className="mb-5 flex-row gap-2.5">
              {/* Option A: Live Tracking Mode */}
              <HapticPressable
                className={`flex-1 rounded-2xl border p-3.5 ${
                  trackingIntent === "live"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-900/60"
                }`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTrackingIntent("live");
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Ionicons
                    name="flash"
                    size={16}
                    color={trackingIntent === "live" ? "#34d399" : "#a1a1aa"}
                  />
                  <Ionicons
                    name={
                      trackingIntent === "live"
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={16}
                    color={trackingIntent === "live" ? "#34d399" : "#71717a"}
                  />
                </View>
                <Text className="mt-2 text-xs font-bold text-white">
                  Live Tracking
                </Text>
                <Text className="mt-0.5 text-[10px] leading-tight text-zinc-400">
                  Real-time Sportradar feed & leg alerts
                </Text>
              </HapticPressable>

              {/* Option B: Historical / Settled Slip */}
              <HapticPressable
                className={`flex-1 rounded-2xl border p-3.5 ${
                  trackingIntent === "historical"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-900/60"
                }`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setTrackingIntent("historical");
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Ionicons
                    name="archive-outline"
                    size={16}
                    color={
                      trackingIntent === "historical" ? "#34d399" : "#a1a1aa"
                    }
                  />
                  <Ionicons
                    name={
                      trackingIntent === "historical"
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={16}
                    color={
                      trackingIntent === "historical" ? "#34d399" : "#71717a"
                    }
                  />
                </View>
                <Text className="mt-2 text-xs font-bold text-white">
                  Historical Slip
                </Text>
                <Text className="mt-0.5 text-[10px] leading-tight text-zinc-400">
                  Add settled bet to verified record
                </Text>
              </HapticPressable>
            </View>

            {/* Step 2: Dropzone & File Intake */}
            <Text className="mb-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              DROP TICKET OR SCREENSHOT
            </Text>
            <HapticPressable
              className={`mb-4 items-center rounded-2xl border-2 border-dashed p-6 text-center ${
                selectedFile
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/40"
              }`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSelectedFile({
                  name: "DraftKings_4Leg_SGP_BOS_IND.png",
                  size: "1.4 MB",
                });
              }}
            >
              <View className="mb-3 size-12 items-center justify-center rounded-2xl bg-zinc-800">
                <Ionicons
                  name={selectedFile ? "document-text" : "cloud-upload-outline"}
                  size={24}
                  color={selectedFile ? "#34d399" : "#a1a1aa"}
                />
              </View>
              <Text className="text-sm font-bold text-white">
                {selectedFile
                  ? selectedFile.name
                  : "Tap to select bet slip screenshot"}
              </Text>
              <Text className="mt-1 text-center text-[11px] text-zinc-400">
                {selectedFile
                  ? `${selectedFile.size} · Ready to extract`
                  : "PNG, JPG, or PDF from FanDuel, DraftKings, BetMGM"}
              </Text>
            </HapticPressable>

            {/* Extraction Progress Box */}
            {extractionStatus === "extracting" && (
              <GlassCard className="mb-5 p-4" variant="accent">
                <View className="flex-row items-center gap-3">
                  <ActivityIndicator color="#34d399" size="small" />
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-white">
                      {EXTRACTION_PHASES[phaseIndex]}
                    </Text>
                    <Text className="mt-0.5 text-[10px] text-zinc-400">
                      Multimodal OCR Entity Pipeline
                    </Text>
                  </View>
                </View>
                <View className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <View
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${((phaseIndex + 1) / 4) * 100}%` }}
                  />
                </View>
              </GlassCard>
            )}

            {/* Step 3: Extracted Legs Review Accordion (No odds!) */}
            {extractionStatus === "reviewed" && (
              <View className="mb-5">
                <View className="mb-2.5 flex-row items-center justify-between">
                  <Text className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
                    REVIEW EXTRACTED LEGS (4)
                  </Text>
                  <View className="flex-row items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5">
                    <Ionicons
                      name="shield-checkmark"
                      size={12}
                      color="#34d399"
                    />
                    <Text className="font-mono text-[10px] font-bold text-emerald-400">
                      100% Parsed
                    </Text>
                  </View>
                </View>

                {extractedLegs.map((leg) => {
                  const isLegOpen = expandedLegId === leg.id;
                  return (
                    <GlassCard key={leg.id} className="mb-2 p-3">
                      <HapticPressable
                        className="flex-row items-center justify-between"
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setExpandedLegId(isLegOpen ? null : leg.id);
                        }}
                      >
                        <View className="flex-1">
                          <Text className="text-xs font-bold text-white">
                            {leg.player}
                          </Text>
                          <Text className="mt-0.5 text-xs text-emerald-400">
                            {leg.line}
                          </Text>
                        </View>
                        <Ionicons
                          name={isLegOpen ? "chevron-up" : "chevron-down"}
                          size={14}
                          color="#71717a"
                        />
                      </HapticPressable>

                      {isLegOpen && (
                        <View className="mt-2.5 border-t border-zinc-800/60 pt-2">
                          <View className="flex-row items-center justify-between text-xs">
                            <Text className="text-[11px] text-zinc-400">
                              Team: {leg.team}
                            </Text>
                            <Text className="font-mono text-[11px] text-zinc-400">
                              Confidence: {leg.confidence}
                            </Text>
                          </View>
                        </View>
                      )}
                    </GlassCard>
                  );
                })}
              </View>
            )}

            {/* Footer Buttons */}
            <View className="mt-2 flex-row items-center justify-between">
              <HapticPressable
                disabled={!selectedFile || extractionStatus === "extracting"}
                onPress={handleResetModal}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selectedFile ? "text-zinc-400" : "text-zinc-700"
                  }`}
                >
                  Clear File
                </Text>
              </HapticPressable>

              {extractionStatus === "reviewed" ? (
                <HapticPressable
                  className="flex-row items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 shadow-lg shadow-emerald-500/25"
                  onPress={handleConfirmSlip}
                >
                  <Ionicons name="checkmark" size={16} color="#09090b" />
                  <Text className="text-xs font-bold text-zinc-950">
                    Confirm & Start Tracking
                  </Text>
                </HapticPressable>
              ) : (
                <HapticPressable
                  disabled={!selectedFile || extractionStatus === "extracting"}
                  className={`flex-row items-center gap-2 rounded-xl px-5 py-3 ${
                    selectedFile && extractionStatus !== "extracting"
                      ? "bg-emerald-500 shadow-lg shadow-emerald-500/25"
                      : "bg-zinc-800"
                  }`}
                  onPress={handleStartExtraction}
                >
                  <Ionicons
                    name="sparkles"
                    size={16}
                    color={
                      selectedFile && extractionStatus !== "extracting"
                        ? "#09090b"
                        : "#71717a"
                    }
                  />
                  <Text
                    className={`text-xs font-bold ${
                      selectedFile && extractionStatus !== "extracting"
                        ? "text-zinc-950"
                        : "text-zinc-500"
                    }`}
                  >
                    Extract Legs with AI
                  </Text>
                </HapticPressable>
              )}
            </View>

            {/* Accuracy Tips */}
            <View className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4">
              <Text className="text-xs font-bold text-zinc-300">
                Tips for Best OCR Accuracy
              </Text>
              <Text className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                • Include the sportsbook banner (FanDuel, DraftKings, BetMGM) in
                the screenshot
              </Text>
              <Text className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                • Make sure all leg lines (player, over/under, stat line) are
                visible and not cropped
              </Text>
              <Text className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
                • Review each extracted leg before finalizing tracking
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* TICKET ID DETAIL PAGE MODAL */}
      <TicketDetailModal
        onClose={() => setSelectedTicket(null)}
        ticket={selectedTicket}
        visible={selectedTicket !== null}
      />
    </SafeAreaView>
  );
}
