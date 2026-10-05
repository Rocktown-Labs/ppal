import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAppState } from "@/lib/app-state";

export default function RootIndex() {
  const { hasCompletedOnboarding, isAuthenticated, isLoading } = useAppState();

  if (isLoading) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#09090b",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#34d399" size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
