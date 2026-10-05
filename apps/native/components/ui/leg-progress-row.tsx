import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { MobileLeg } from "@/lib/api-client";
import { StatusBadge } from "./status-badge";

export interface LegProgressRowProps {
  leg: MobileLeg;
}

export function LegProgressRow({ leg }: LegProgressRowProps) {
  const current = leg.currentValue ?? 0;
  const target = leg.targetValue ?? 0;
  const percent =
    target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

  const getStatusColor = () => {
    if (leg.status === "won") return "text-emerald-400";
    if (leg.status === "lost") return "text-rose-400";
    if (leg.status === "live") return "text-amber-400";
    return "text-zinc-400";
  };

  return (
    <View className="mb-2.5 rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-bold text-zinc-100">
              {leg.subjectName}
            </Text>
            {leg.timeRemaining && (
              <View className="rounded bg-zinc-800/80 px-1.5 py-0.5">
                <Text className="font-mono text-[10px] font-medium text-zinc-400">
                  {leg.timeRemaining}
                </Text>
              </View>
            )}
          </View>
          <Text className="mt-0.5 text-xs text-zinc-400">
            {leg.rawDescription || leg.marketDescription}
          </Text>
        </View>

        <View className="items-end gap-1">
          <StatusBadge
            label={leg.status === "live" ? "IN PLAY" : undefined}
            size="sm"
            status={leg.status}
          />
          <Text
            className={`font-mono text-xs font-bold ${getStatusColor()}`}
            style={styles.tabular}
          >
            {target > 0 ? `${current} / ${target}` : leg.operator.toUpperCase()}
          </Text>
        </View>
      </View>

      {target > 0 && (
        <View className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800/90">
          <View
            className={`h-full rounded-full transition-all duration-300 ${
              leg.status === "won"
                ? "bg-emerald-400"
                : leg.status === "lost"
                  ? "bg-rose-500"
                  : "bg-emerald-500"
            }`}
            style={{ width: `${percent}%` }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ["tabular-nums"],
  },
});
