import * as Haptics from "expo-haptics";
import { usePathname } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import React, { useRef } from "react";
import { useAppState } from "@/lib/app-state";

export default function TabLayout() {
  const { setIsUploadModalOpen } = useAppState();
  const pathname = usePathname();
  const lastTicketsTapRef = useRef<number>(0);
  const isAlreadyOnTickets = pathname === "/tickets" || pathname.includes("tickets");

  return (
    <NativeTabs
      tintColor="#34d399"
      blurEffect="systemChromeMaterialDark"
      minimizeBehavior="onScrollDown"
      iconColor={{
        default: "#a1a1aa",
        selected: "#34d399",
      }}
      labelStyle={{
        default: { color: "#a1a1aa" },
        selected: { color: "#34d399" },
      }}
    >
      {/* 1. HOME */}
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home" }}
        />
      </NativeTabs.Trigger>

      {/* 2. ANALYTICS */}
      <NativeTabs.Trigger name="analytics">
        <NativeTabs.Trigger.Label>Analytics</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md={{ default: "analytics", selected: "analytics" }}
        />
      </NativeTabs.Trigger>

      {/* 3. TICKETS (Center Upload + / Slip Details) */}
      <NativeTabs.Trigger
        name="tickets"
        listeners={{
          tabPress: () => {
            Haptics.selectionAsync().catch(() => {});
            const now = Date.now();
            const isDoubleTap = now - lastTicketsTapRef.current < 500;

            if (isAlreadyOnTickets || isDoubleTap) {
              // Tapping again when already on Tickets tab or double-tapping opens the slip uploader
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {}
              );
              setIsUploadModalOpen(true);
            }
            lastTicketsTapRef.current = now;
          },
        }}
      >
        <NativeTabs.Trigger.Label>Tickets</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "plus.circle", selected: "plus.circle.fill" }}
          md={{ default: "add_circle", selected: "add_circle" }}
        />
      </NativeTabs.Trigger>

      {/* 4. COMMUNITIES */}
      <NativeTabs.Trigger name="communities">
        <NativeTabs.Trigger.Label>Community</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "bubble.left.and.bubble.right",
            selected: "bubble.left.and.bubble.right.fill",
          }}
          md={{ default: "chat", selected: "chat" }}
        />
      </NativeTabs.Trigger>

      {/* 5. ME / PROFILE */}
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
          md={{ default: "person", selected: "person" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
