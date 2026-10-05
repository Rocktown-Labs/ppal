import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard } from "@/components/ui/glass-card";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { LegProgressRow } from "@/components/ui/leg-progress-row";
import { StatusBadge } from "@/components/ui/status-badge";
import type { MobileLeg, MobileTicket } from "@/lib/api-client";

export interface TicketDetailModalProps {
  onClose: () => void;
  ticket: MobileTicket | null;
  visible: boolean;
}

export function TicketDetailModal({
  onClose,
  ticket,
  visible,
}: TicketDetailModalProps) {
  if (!ticket) return null;

  const legs = ticket.legs ?? [];
  const wonLegs = legs.filter((l) => l.status === "won").length;
  const lostLegs = legs.filter((l) => l.status === "lost").length;
  const liveLegs = legs.filter((l) => l.status === "live").length;

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Tracking my ${ticket.sourceName} ticket for ${ticket.sportsEvent} on ParlayPal. ${wonLegs}/${legs.length} legs hit so far!`,
        title: `ParlayPal Ticket #${ticket.id}`,
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
        {/* Navigation Bar */}
        <View className="flex-row items-center justify-between border-b border-zinc-800/80 px-4 py-3">
          <View>
            <Text className="font-mono text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
              TICKET #{ticket.id.toUpperCase()}
            </Text>
            <Text className="text-base font-bold text-white">
              {ticket.sourceName}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <HapticPressable
              accessibilityLabel="Share ticket"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={16} color="#e4e4e7" />
            </HapticPressable>

            <HapticPressable
              accessibilityLabel="Close ticket details"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={onClose}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{
            paddingBottom: Platform.OS === "ios" ? 40 : 24,
            paddingTop: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Matchup & Status Hero Card */}
          <GlassCard className="mb-4 p-4" variant="elevated">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-2">
                <Text className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                  {ticket.ticketType}
                </Text>
                <Text className="mt-0.5 text-lg font-black text-white">
                  {ticket.sportsEvent}
                </Text>
              </View>
              <StatusBadge status={ticket.status} />
            </View>

            {/* Verification & Leg Summary */}
            <View className="mt-4 flex-row gap-2 border-t border-zinc-800/80 pt-3">
              <View className="flex-1 rounded-xl bg-zinc-950 p-2.5">
                <Text className="text-[10px] text-zinc-500 uppercase">
                  Settled
                </Text>
                <Text
                  className="mt-0.5 font-mono text-base font-bold text-white"
                  style={styles.tabular}
                >
                  {wonLegs}/{legs.length}
                </Text>
                <Text className="text-[9px] text-zinc-400">
                  {lostLegs > 0 ? `${lostLegs} missed` : "On track"}
                </Text>
              </View>

              <View className="flex-1 rounded-xl bg-zinc-950 p-2.5">
                <Text className="text-[10px] text-zinc-500 uppercase">
                  Active
                </Text>
                <Text
                  className="mt-0.5 font-mono text-base font-bold text-amber-400"
                  style={styles.tabular}
                >
                  {liveLegs}
                </Text>
                <Text className="text-[9px] text-zinc-400">Live in play</Text>
              </View>

              <View className="flex-1 rounded-xl bg-zinc-950 p-2.5">
                <Text className="text-[10px] text-zinc-500 uppercase">
                  Data Feed
                </Text>
                <Text className="mt-0.5 text-xs font-bold text-emerald-400">
                  Live API
                </Text>
                <Text className="text-[9px] text-zinc-400">Sportradar</Text>
              </View>
            </View>
          </GlassCard>

          {/* Section: Bet Legs */}
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
              BET LEGS ({legs.length})
            </Text>
            <Text className="font-mono text-[10px] text-zinc-500">
              Live updates enabled
            </Text>
          </View>

          {legs.map((leg: MobileLeg) => (
            <LegProgressRow key={leg.id} leg={leg} />
          ))}

          {/* Verification Audit Footer */}
          <View className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5">
            <View className="flex-row items-center gap-2">
              <Ionicons name="shield-checkmark" size={15} color="#34d399" />
              <Text className="text-xs font-bold text-white">
                Verified API Settlement
              </Text>
            </View>
            <Text className="mt-1 text-[11px] leading-relaxed text-zinc-400">
              Every leg is matched against official league play-by-play data and
              settled without manual input.
            </Text>
          </View>

          {/* Done Button */}
          <HapticPressable
            className="mt-5 items-center rounded-xl bg-zinc-800 py-3"
            onPress={onClose}
          >
            <Text className="text-xs font-bold text-white">Done</Text>
          </HapticPressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
