import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GoogleIcon } from "@/components/icons/google-icon";
import { GlassCard } from "@/components/ui/glass-card";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { useAppState } from "@/lib/app-state";
import { authClient } from "@/lib/auth-client";

export default function AuthScreen() {
  const { hasCompletedOnboarding, loginAsDemo, loginReal } = useAppState();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectAfterAuth = () => {
    router.replace(hasCompletedOnboarding ? "/(tabs)" : "/onboarding");
  };

  // The OAuth browser round-trip resumes the app here; adopt the session.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const adoptSession = async () => {
        try {
          const session = await authClient.getSession();
          const sessionUser = session.data?.user;
          if (active && sessionUser) {
            await loginReal({
              email: sessionUser.email,
              name: sessionUser.name,
            });
            redirectAfterAuth();
          }
        } catch {
          // No session to adopt.
        }
      };
      void adoptSession();
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasCompletedOnboarding])
  );

  const handleModeSwitch = (newMode: "signin" | "signup") => {
    Haptics.selectionAsync().catch(() => {});
    setAuthError(null);
    setMode(newMode);
  };

  const handleDemoLogin = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    await loginAsDemo();
    setIsSubmitting(false);
    redirectAfterAuth();
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password || (mode === "signup" && !name.trim())) {
      setAuthError("Please fill in every field.");
      return;
    }
    if (mode === "signup" && !agreedToTerms) {
      setAuthError("Please agree to the Terms of Service.");
      return;
    }
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const result =
        mode === "signin"
          ? await authClient.signIn.email({
              email: email.trim().toLowerCase(),
              password,
            })
          : await authClient.signUp.email({
              email: email.trim().toLowerCase(),
              name: name.trim(),
              password,
            });
      if (result.error) {
        setAuthError(result.error.message ?? "Authentication failed.");
        return;
      }
      const session = await authClient.getSession();
      const sessionUser = session.data?.user;
      await loginReal({
        email: sessionUser?.email ?? email.trim().toLowerCase(),
        name: sessionUser?.name ?? name.trim(),
      });
      redirectAfterAuth();
    } catch {
      setAuthError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const { error } = await authClient.signIn.social({
        callbackURL: "/",
        provider: "google",
      });
      if (error) {
        setAuthError(error.message ?? "Google sign-in failed.");
      }
    } catch {
      setAuthError("Google sign-in is unavailable right now.");
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-zinc-950"
      style={{ flex: 1, backgroundColor: "#09090b" }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingVertical: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Logo & Header */}
          <View className="mb-6 items-center">
            <Image
              source={require("@/assets/images/parlaypal-logo.png")}
              style={{
                height: 48,
                width: 160,
                marginBottom: 14,
              }}
              resizeMode="contain"
            />
            <Text className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
              {mode === "signin" ? "WELCOME BACK" : "GET STARTED"}
            </Text>
            <Text className="mt-2 text-center text-3xl font-bold tracking-tight text-white">
              {mode === "signin"
                ? "Pick up where you left off."
                : "Create your account."}
            </Text>
            <Text className="mt-2 text-center text-xs leading-5 text-zinc-400">
              {mode === "signin"
                ? "Sign in to see your live tickets, progress, and notifications."
                : "Track every leg, score, and cashout opportunity in real time."}
            </Text>
          </View>

          {/* Form Card */}
          <GlassCard className="mb-4 rounded-3xl p-6" variant="elevated">
            <Text className="mb-4 text-lg font-bold text-white">
              {mode === "signin" ? "Sign In" : "Sign Up"}
            </Text>

            {/* Social Login Button */}
            <HapticPressable
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                backgroundColor: "#18181b",
                borderColor: "#27272a",
                borderWidth: 1,
                borderRadius: 14,
                paddingVertical: 13,
                paddingHorizontal: 16,
              }}
              onPress={handleGoogleLogin}
            >
              <GoogleIcon size={18} />
              <Text
                style={{
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: "600",
                  letterSpacing: -0.2,
                }}
              >
                Continue with Google
              </Text>
            </HapticPressable>

            {/* OR Divider */}
            <View className="my-4 flex-row items-center gap-3">
              <View className="h-px flex-1 bg-zinc-800" />
              <Text className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                OR
              </Text>
              <View className="h-px flex-1 bg-zinc-800" />
            </View>

            {/* Name Input (Signup only) */}
            {mode === "signup" && (
              <View className="mb-3.5">
                <Text className="mb-1 text-xs font-medium text-zinc-300">
                  Name <Text className="text-rose-400">*</Text>
                </Text>
                <TextInput
                  autoCapitalize="words"
                  autoComplete="name"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-white"
                  onChangeText={setName}
                  placeholder="Cameron Stewart"
                  placeholderTextColor="#71717a"
                  style={styles.input}
                  value={name}
                />
              </View>
            )}

            {/* Email Input */}
            <View className="mb-3.5">
              <Text className="mb-1 text-xs font-medium text-zinc-300">
                Email <Text className="text-rose-400">*</Text>
              </Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-white"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="camgstewart@icloud.com"
                placeholderTextColor="#71717a"
                style={styles.input}
                value={email}
              />
            </View>

            {/* Password Input */}
            <View className="mb-4">
              <Text className="mb-1 text-xs font-medium text-zinc-300">
                Password <Text className="text-rose-400">*</Text>
              </Text>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-3 text-white"
                onChangeText={setPassword}
                placeholder="••••••••••••"
                placeholderTextColor="#71717a"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            {/* Terms checkbox on sign up */}
            {mode === "signup" && (
              <HapticPressable
                className="mb-4 flex-row items-center gap-2.5"
                onPress={() => setAgreedToTerms(!agreedToTerms)}
              >
                <View
                  className={`size-4 items-center justify-center rounded-md border ${
                    agreedToTerms
                      ? "border-emerald-400 bg-emerald-400 text-black"
                      : "border-zinc-700 bg-transparent"
                  }`}
                >
                  {agreedToTerms && (
                    <Ionicons name="checkmark" size={12} color="#000000" />
                  )}
                </View>
                <Text className="text-xs text-zinc-400">
                  I agree to the Terms of Service and Privacy Policy.
                </Text>
              </HapticPressable>
            )}

            {/* Auth Error Message */}
            {authError ? (
              <View className="mb-3 flex-row items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                <Ionicons name="alert-circle" size={13} color="#fb7185" />
                <Text className="flex-1 text-xs text-rose-400">
                  {authError}
                </Text>
              </View>
            ) : null}

            {/* Primary Action Button */}
            <HapticPressable
              className="items-center justify-center rounded-xl bg-zinc-200 py-3.5 active:bg-white"
              disabled={isSubmitting}
              onPress={handleSubmit}
            >
              <Text className="text-sm font-bold text-zinc-950">
                {isSubmitting
                  ? "Processing..."
                  : mode === "signin"
                    ? "Sign In"
                    : "Sign Up"}
              </Text>
            </HapticPressable>

            {/* Secondary Link */}
            <View className="mt-4 items-center gap-1.5">
              {mode === "signin" && (
                <Text className="text-xs font-semibold text-zinc-400">
                  Forgot password?
                </Text>
              )}
              <HapticPressable
                onPress={() =>
                  handleModeSwitch(mode === "signin" ? "signup" : "signin")
                }
              >
                <Text className="text-xs text-zinc-400">
                  {mode === "signin"
                    ? "Need to create an account? "
                    : "Already have an account? "}
                  <Text className="font-semibold text-emerald-400 underline">
                    {mode === "signin" ? "Sign Up" : "Sign In"}
                  </Text>
                </Text>
              </HapticPressable>
            </View>
          </GlassCard>

          {/* Quick Demo Access — development builds only */}
          {__DEV__ ? (
            <View className="items-center pt-2">
              <HapticPressable
                className="w-full flex-row items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 py-3"
                disabled={isSubmitting}
                onPress={handleDemoLogin}
              >
                <Ionicons name="sparkles" size={16} color="#34d399" />
                <Text className="text-xs font-semibold text-zinc-300">
                  Quick Test: Explore as Verified Bettor (@cgstewart)
                </Text>
              </HapticPressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 16, // mobile-native requirement: >= 16px to prevent iOS auto-zoom
  },
});
