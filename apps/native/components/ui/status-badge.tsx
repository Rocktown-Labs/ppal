import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

export type StatusBadgeType =
  | "live"
  | "won"
  | "lost"
  | "push"
  | "void"
  | "scheduled"
  | "needs_review"
  | "verified"
  | "pending";

export interface StatusBadgeProps {
  label?: string;
  size?: "sm" | "md";
  status: StatusBadgeType;
}

export function StatusBadge({ label, size = "md", status }: StatusBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (status === "live") {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            duration: 800,
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            duration: 800,
            toValue: 0.4,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [pulseAnim, status]);

  const isSmall = size === "sm";

  switch (status) {
    case "live":
      return (
        <View
          className={`flex-row items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Animated.View
            className="size-1.5 rounded-full bg-emerald-400"
            style={{ opacity: pulseAnim }}
          />
          <Text
            className={`font-semibold tracking-wide text-emerald-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? "LIVE"}
          </Text>
        </View>
      );

    case "won":
      return (
        <View
          className={`flex-row items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Ionicons
            name="checkmark-circle"
            size={isSmall ? 10 : 12}
            color="#34d399"
          />
          <Text
            className={`font-semibold tracking-wide text-emerald-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? "WON"}
          </Text>
        </View>
      );

    case "lost":
      return (
        <View
          className={`flex-row items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Ionicons name="close-circle" size={isSmall ? 10 : 12} color="#fb7185" />
          <Text
            className={`font-semibold tracking-wide text-rose-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? "LOST"}
          </Text>
        </View>
      );

    case "needs_review":
      return (
        <View
          className={`flex-row items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Ionicons
            name="alert-circle"
            size={isSmall ? 10 : 12}
            color="#fbbf24"
          />
          <Text
            className={`font-semibold tracking-wide text-amber-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? "NEEDS REVIEW"}
          </Text>
        </View>
      );

    case "scheduled":
      return (
        <View
          className={`flex-row items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Ionicons name="time-outline" size={isSmall ? 10 : 12} color="#60a5fa" />
          <Text
            className={`font-semibold tracking-wide text-blue-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? "SCHEDULED"}
          </Text>
        </View>
      );

    case "verified":
      return (
        <View
          className={`flex-row items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Ionicons
            name="shield-checkmark"
            size={isSmall ? 10 : 12}
            color="#34d399"
          />
          <Text
            className={`font-semibold tracking-wide text-emerald-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? "VERIFIED"}
          </Text>
        </View>
      );

    case "push":
      return (
        <View
          className={`flex-row items-center gap-1 rounded-full border border-zinc-600/40 bg-zinc-700/20 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Ionicons
            name="remove-circle-outline"
            size={isSmall ? 10 : 12}
            color="#a1a1aa"
          />
          <Text
            className={`font-semibold tracking-wide text-zinc-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? "PUSH"}
          </Text>
        </View>
      );

    case "void":
      return (
        <View
          className={`flex-row items-center gap-1 rounded-full border border-zinc-600/40 bg-zinc-700/20 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Ionicons
            name="ban-outline"
            size={isSmall ? 10 : 12}
            color="#a1a1aa"
          />
          <Text
            className={`font-semibold tracking-wide text-zinc-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? "VOID"}
          </Text>
        </View>
      );

    default:
      return (
        <View
          className={`rounded-full border border-zinc-800 bg-zinc-800/80 ${
            isSmall ? "px-2 py-0.5" : "px-2.5 py-1"
          }`}
        >
          <Text
            className={`font-medium tracking-wide text-zinc-400 uppercase ${
              isSmall ? "text-[10px]" : "text-xs"
            }`}
          >
            {label ?? status.toUpperCase()}
          </Text>
        </View>
      );
  }
}
