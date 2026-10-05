import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard } from "@/components/ui/glass-card";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type MobileNotification,
  useNotificationsData,
} from "@/lib/api-client";

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const { data: initialList, refetch } = useNotificationsData();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<MobileNotification[]>(
    initialList ?? []
  );

  React.useEffect(() => {
    if (initialList) {
      setNotifications(initialList);
    }
  }, [initialList]);

  const handleFilter = (tab: "all" | "unread") => {
    Haptics.selectionAsync().catch(() => {});
    setFilter(tab);
  };

  const handleDismiss = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemPress = async (item: MobileNotification) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Mark as read locally and in query cache
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    queryClient.setQueryData(
      ["mobile-notifications-data"],
      (prev: MobileNotification[] | undefined) =>
        prev
          ? prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
          : []
    );
    await markNotificationAsRead(item.id);
    // Navigate to ticket view if related
    if (item.ticketId) {
      router.push("/(tabs)/tickets");
    }
  };

  const handleMarkAllRead = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    queryClient.setQueriesData(
      { queryKey: ["mobile-notifications-data"] },
      (prev: MobileNotification[] | undefined) =>
        prev ? prev.map((n) => ({ ...n, read: true })) : []
    );
    await markAllNotificationsAsRead();
    refetch();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredItems = notifications.filter((item) => {
    if (filter === "unread") return !item.read;
    return true;
  });

  return (
    <SafeAreaView
      className="flex-1 bg-zinc-950"
      style={{ flex: 1, backgroundColor: "#09090b" }}
    >
      <View className="flex-1 px-4 pt-2">
        {/* Header with X close button and Read All action */}
        <View className="mb-4 flex-row items-center justify-between border-b border-zinc-800/80 pb-3">
          <View>
            <Text className="text-[10px] font-bold tracking-[0.16em] text-emerald-400 uppercase">
              ACTIVITY FEED
            </Text>
            <Text className="text-lg font-bold text-white">Notifications</Text>
          </View>

          <View className="flex-row items-center gap-2">
            {unreadCount > 0 && (
              <HapticPressable
                accessibilityLabel="Mark all as read"
                className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5"
                onPress={handleMarkAllRead}
              >
                <Text className="text-[11px] font-semibold text-emerald-400">
                  Read all
                </Text>
              </HapticPressable>
            )}

            <HapticPressable
              accessibilityLabel="Close notifications sheet"
              className="size-8 items-center justify-center rounded-full bg-zinc-800"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(tabs)");
                }
              }}
            >
              <Ionicons name="close" size={18} color="#d4d4d8" />
            </HapticPressable>
          </View>
        </View>

        {/* Filter Pills */}
        <View className="mb-4 flex-row gap-2">
          <HapticPressable
            className={`rounded-full px-3.5 py-1.5 ${
              filter === "all"
                ? "border border-emerald-400/40 bg-emerald-400/10"
                : "border border-zinc-800 bg-zinc-900/60"
            }`}
            onPress={() => handleFilter("all")}
          >
            <Text
              className={`text-xs font-semibold ${
                filter === "all" ? "text-emerald-300" : "text-zinc-400"
              }`}
            >
              All ({notifications.length})
            </Text>
          </HapticPressable>

          <HapticPressable
            className={`rounded-full px-3.5 py-1.5 ${
              filter === "unread"
                ? "border border-emerald-400/40 bg-emerald-400/10"
                : "border border-zinc-800 bg-zinc-900/60"
            }`}
            onPress={() => handleFilter("unread")}
          >
            <Text
              className={`text-xs font-semibold ${
                filter === "unread" ? "text-emerald-300" : "text-zinc-400"
              }`}
            >
              Unread ({unreadCount})
            </Text>
          </HapticPressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: Platform.OS === "ios" ? 40 : 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.length === 0 ? (
            /* Empty State Matching Image 7 */
            <GlassCard className="mt-8 items-center p-10 text-center">
              <View className="mb-3 size-14 items-center justify-center rounded-2xl bg-zinc-900">
                <Ionicons name="notifications-outline" size={26} color="#71717a" />
              </View>
              <Text className="text-base font-bold text-white">
                No notifications
              </Text>
              <Text className="mt-1 text-center text-xs leading-5 text-zinc-500">
                When games are live and legs hit, updates appear here.
              </Text>
            </GlassCard>
          ) : (
            <View className="gap-2.5">
              {filteredItems.map((item) => (
                <GlassCard
                  key={item.id}
                  className={`p-3.5 ${
                    !item.read
                      ? "border-emerald-500/30 bg-zinc-900/90"
                      : "border-zinc-800/60 bg-zinc-900/40"
                  }`}
                >
                  <View className="flex-row items-start gap-3">
                    <HapticPressable
                      className="flex-1 flex-row items-start gap-3"
                      onPress={() => handleItemPress(item)}
                    >
                      <View className="mt-0.5 size-7 items-center justify-center rounded-lg bg-zinc-800">
                        <Ionicons
                          name={
                            item.category === "leg_hit"
                              ? "checkmark-circle"
                              : item.category === "cashout"
                                ? "trending-up"
                                : item.category === "ticket_won"
                                  ? "trophy"
                                  : "notifications"
                          }
                          size={15}
                          color={
                            item.category === "cashout" ? "#fbbf24" : "#34d399"
                          }
                        />
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs font-bold text-white">
                            {item.title}
                          </Text>
                          <Text className="text-[10px] text-zinc-500">
                            {item.createdAt}
                          </Text>
                        </View>
                        <Text className="mt-1 text-xs leading-relaxed text-zinc-300">
                          {item.body}
                        </Text>
                      </View>
                    </HapticPressable>

                    {/* Dismiss Button */}
                    <HapticPressable
                      className="p-1"
                      onPress={() => handleDismiss(item.id)}
                    >
                      <Ionicons name="close" size={16} color="#71717a" />
                    </HapticPressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
