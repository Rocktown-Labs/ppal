import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import { GlassCard } from "@/components/ui/glass-card";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { StatusBadge } from "@/components/ui/status-badge";

export default function Modal() {
  function handleClose() {
    router.back();
  }

  return (
    <View className="flex-1 items-center justify-center bg-zinc-950 p-4">
      <GlassCard className="w-full max-w-sm p-6" variant="elevated">
        <View className="items-center">
          <View className="mb-3 size-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <Ionicons name="shield-checkmark" size={24} color="#34d399" />
          </View>

          <Text className="text-base font-bold text-white">
            Leg Settlement Details
          </Text>
          <Text className="mt-1 mb-4 text-center text-xs text-zinc-400">
            Live feed verified via official NBA play-by-play. Odds locked at placement.
          </Text>

          <View className="mb-4 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-zinc-300">
                Settlement Status
              </Text>
              <StatusBadge size="sm" status="won" />
            </View>
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-xs text-zinc-500">Official Timestamp</Text>
              <Text className="font-mono text-xs text-zinc-300">3Q 1:44 PM</Text>
            </View>
          </View>
        </View>

        <HapticPressable
          className="items-center justify-center rounded-xl bg-emerald-500 py-3"
          onPress={handleClose}
        >
          <Text className="text-xs font-bold text-zinc-950">Done</Text>
        </HapticPressable>
      </GlassCard>
    </View>
  );
}
