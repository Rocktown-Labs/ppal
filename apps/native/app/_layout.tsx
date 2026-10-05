import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import React, { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { DarkTheme, ThemeProvider } from "expo-router/react-navigation";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { AppStateProvider } from "@/lib/app-state";

export const unstable_settings = {
  initialRouteName: "index",
};

function StackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "#09090b" },
        headerStyle: { backgroundColor: "#09090b" },
        headerTintColor: "#f4f4f5",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="notifications"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="modal"
        options={{
          presentation: "modal",
          title: "Leg Details",
          headerShown: true,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#09090b" }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <ThemeProvider value={DarkTheme}>
              <HeroUINativeProvider>
                <AppStateProvider>
                  <StackLayout />
                </AppStateProvider>
              </HeroUINativeProvider>
            </ThemeProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
