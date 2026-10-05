import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "accent";
}

export function GlassCard({
  children,
  className = "",
  style,
  variant = "default",
}: GlassCardProps) {
  return (
    <View
      className={`rounded-2xl border ${
        variant === "accent"
          ? "border-emerald-500/30 bg-zinc-900/90"
          : variant === "elevated"
            ? "border-zinc-700/60 bg-zinc-900/95"
            : "border-zinc-800/80 bg-zinc-900/70"
      } p-4 ${className}`}
      style={[styles.base, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
});
