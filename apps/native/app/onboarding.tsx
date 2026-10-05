import { Ionicons } from "@expo/vector-icons";
import { validateUsernameWithBloomFilter } from "@ppal/contracts/bloom-filter";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GlassCard } from "@/components/ui/glass-card";
import { HapticPressable } from "@/components/ui/haptic-pressable";
import { client } from "@/lib/api-client";
import { isDemoUser, useAppState } from "@/lib/app-state";

const SPORTS_LIST = [
  { detail: "NBA · WNBA · NCAA", icon: "basketball-outline" as const, id: "basketball", name: "Basketball" },
  { detail: "NFL · NCAA", icon: "american-football-outline" as const, id: "football", name: "Football" },
  { detail: "MLB", icon: "baseball-outline" as const, id: "baseball", name: "Baseball" },
  { detail: "NHL", icon: "snow-outline" as const, id: "hockey", name: "Hockey" },
  { detail: "International", icon: "football-outline" as const, id: "soccer", name: "Soccer" },
  { detail: "UFC", icon: "flash-outline" as const, id: "mma", name: "MMA" },
  { detail: "ATP · WTA", icon: "tennisball-outline" as const, id: "tennis", name: "Tennis" },
  { detail: "NASCAR · F1", icon: "car-sport-outline" as const, id: "racing", name: "Racing" },
  { detail: "PGA Tour", icon: "flag-outline" as const, id: "golf", name: "Golf" },
];

const PLANS = {
  free: {
    badge: "STARTER",
    buttonText: "Continue Free",
    color: "zinc",
    features: [
      { bold: false, included: true, text: "5 tracked tickets / mo" },
      { bold: false, included: true, text: "Real-time in-app updates" },
      { bold: false, included: false, text: "Basic analytics only" },
    ],
    name: "Free",
    num: "01",
    period: "/ forever",
    popular: false,
    price: "$0",
    tagline: "A clean place to start.",
  },
  pro: {
    badge: "PRO TRACKER",
    buttonText: "Go Pro →",
    color: "emerald",
    features: [
      { bold: true, included: true, text: "500 tickets / month" },
      { bold: false, included: true, text: "Fast 5-minute game updates" },
      { bold: false, included: true, text: "Full analytics & email alerts" },
    ],
    name: "ParlayPal Pro",
    num: "02",
    period: "/ mo",
    popular: true,
    price: "$12.99",
    tagline: "More volume. More signal.",
  },
  creator: {
    badge: "CREATOR",
    buttonText: "Go Creator →",
    color: "fuchsia",
    features: [
      { bold: true, included: true, text: "1,000 tickets / month" },
      { bold: true, included: true, text: "Bulk archive imports" },
      { bold: false, included: true, text: "Highest priority queue" },
    ],
    name: "ParlayPal Creator",
    num: "03",
    period: "/ mo",
    popular: false,
    price: "$24.99",
    tagline: "Built for the full card.",
  },
} as const;

type PlanKey = keyof typeof PLANS;

export default function OnboardingScreen() {
  const { completeOnboarding, setPermission, user } = useAppState();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Profile state
  const [username, setUsername] = useState("sharp_baller");
  const [profileVisibility, setProfileVisibility] = useState<"private" | "public">("private");

  // Step 2: Preferences state
  const [selectedSports, setSelectedSports] = useState<string[]>(["basketball", "football"]);
  const [notifyLegHits, setNotifyLegHits] = useState(true);
  const [notifyOneLegAway, setNotifyOneLegAway] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notifySms, setNotifySms] = useState(false);

  // Step 3: Plan state
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("free");

  const [isFinishing, setIsFinishing] = useState(false);

  // Bloom Filter availability validation for username
  const usernameValidation = useMemo(() => {
    return validateUsernameWithBloomFilter(username);
  }, [username]);

  const toggleSport = (sportId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedSports((prev) =>
      prev.includes(sportId) ? prev.filter((id) => id !== sportId) : [...prev, sportId]
    );
  };

  const handleNextStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) {
      if (!usernameValidation.available) return;
      setStep(2);
    } else if (step === 2) {
      // Trigger notification permission request in this step as required
      await setPermission("notifications", true);
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBackStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 1) {
      setStep((prev) => (prev - 1) as any);
    }
  };

  const handleFinishOnboarding = async () => {
    setIsFinishing(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!isDemoUser(user)) {
      // Real accounts persist their profile and notification preferences so
      // the rest of the app (and web) sees the same setup.
      await Promise.allSettled([
        client.api.v1.me.$patch({
          json: {
            isPublic: profileVisibility === "public",
            username: username.toLowerCase(),
          },
        }),
        client.api.v1.settings.notifications.$patch({
          json: {
            emailEnabled: notifyEmail,
            inAppEnabled: true,
            legLost: true,
            legWon: notifyLegHits || notifyOneLegAway,
            phoneNumber: notifySms && phoneNumber ? phoneNumber : null,
            pushEnabled: true,
            smsEnabled: notifySms,
            ticketLost: true,
            ticketWon: true,
          },
        }),
      ]);
    }
    await completeOnboarding(selectedSports);
    setIsFinishing(false);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView
      className="flex-1 bg-zinc-950"
      style={{ flex: 1, backgroundColor: "#09090b" }}
    >
      <View className="flex-1 px-5 pt-3">
        {/* Top Stepper Header */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
              GET SET UP
            </Text>
            <Text className="font-mono text-xs text-zinc-500">
              0{step} / 04
            </Text>
          </View>

          {/* Stepper circles connected by lines */}
          <View className="mt-3 flex-row items-center">
            {[1, 2, 3, 4].map((stepNumber, idx) => {
              const isCurrent = step === stepNumber;
              const isCompleted = step > stepNumber;

              return (
                <React.Fragment key={stepNumber}>
                  <View
                    className={`size-7 items-center justify-center rounded-full border ${
                      isCompleted
                        ? "border-emerald-400 bg-emerald-400"
                        : isCurrent
                          ? "border-emerald-400 bg-emerald-400/20"
                          : "border-zinc-800 bg-zinc-900"
                    }`}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={14} color="#000000" />
                    ) : (
                      <Text
                        className={`text-xs font-bold ${
                          isCurrent ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {stepNumber}
                      </Text>
                    )}
                  </View>
                  {idx < 3 && (
                    <View
                      className={`h-0.5 flex-1 ${
                        step > stepNumber ? "bg-emerald-400" : "bg-zinc-800"
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ================= STEP 1: PROFILE ================= */}
          {step === 1 && (
            <View>
              <Text className="text-[11px] font-bold tracking-[0.16em] text-zinc-500 uppercase">
                STEP 01 · PROFILE
              </Text>
              <Text className="mt-1.5 text-3xl font-bold tracking-tight text-white">
                Set up your profile
              </Text>
              <Text className="mt-2 text-xs leading-5 text-zinc-400">
                Choose how you want to show up in the community. Your betting
                record stays private unless you decide to publish it.
              </Text>

              {/* Avatar Box */}
              <GlassCard className="my-5 items-center p-6 text-center">
                <View className="relative mb-3 size-20 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/80">
                  <Ionicons name="camera" size={26} color="#a1a1aa" />
                  <View className="absolute right-0 bottom-0 size-6 items-center justify-center rounded-full bg-emerald-400">
                    <Ionicons name="checkmark" size={14} color="#000000" />
                  </View>
                </View>
                <Text className="text-sm font-semibold text-white">
                  Add a profile photo
                </Text>
                <Text className="mt-1 text-center text-xs text-zinc-400">
                  A photo makes your profile easier for friends to recognize.
                </Text>
                <HapticPressable
                  className="mt-3.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2"
                  onPress={() => Haptics.selectionAsync()}
                >
                  <Text className="text-xs font-semibold text-zinc-200">
                    Choose image
                  </Text>
                </HapticPressable>
                <Text className="mt-2 text-[10px] text-zinc-500">
                  Optional · JPG, PNG, or WebP · 5MB max
                </Text>
              </GlassCard>

              {/* Username Card with Bloom Filter Feedback */}
              <GlassCard className="mb-5 p-5">
                <Text className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                  USERNAME <Text className="text-emerald-400">*</Text>
                </Text>
                <Text className="mt-1 text-xs text-zinc-500">
                  This is the handle people will see if you share your record.
                </Text>

                <View className="mt-3 flex-row items-center rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1">
                  <Text className="text-sm text-zinc-500">@</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 py-2.5 px-2 text-sm text-white"
                    onChangeText={(val) =>
                      setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                    placeholder="sharp_baller"
                    placeholderTextColor="#71717a"
                    style={styles.input}
                    value={username}
                  />
                  {username ? (
                    usernameValidation.available ? (
                      <View className="flex-row items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5">
                        <Ionicons
                          name="checkmark-circle"
                          size={12}
                          color="#34d399"
                        />
                        <Text className="text-[10px] font-bold text-emerald-400">
                          Available
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5">
                        <Ionicons
                          name="alert-circle"
                          size={12}
                          color="#fb7185"
                        />
                        <Text className="text-[10px] font-bold text-rose-400">
                          Reserved
                        </Text>
                      </View>
                    )
                  ) : null}
                </View>

                {!usernameValidation.available && (
                  <Text className="mt-1.5 text-xs text-rose-400">
                    {usernameValidation.reason}
                  </Text>
                )}

                <Text className="mt-2 text-[11px] text-zinc-500">
                  Required · 3–30 characters · letters, numbers, and underscores.
                </Text>

                {/* Who can see your record (Side-by-Side as requested) */}
                <Text className="mt-5 mb-2 text-xs font-bold tracking-wider text-zinc-400 uppercase">
                  WHO CAN SEE YOUR RECORD?
                </Text>
                <View className="flex-row gap-2.5">
                  <HapticPressable
                    className={`flex-1 rounded-2xl border p-3.5 ${
                      profileVisibility === "private"
                        ? "border-emerald-400/60 bg-emerald-400/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setProfileVisibility("private")}
                  >
                    <View className="flex-row items-center gap-2">
                      <View
                        className={`size-4 items-center justify-center rounded-full border ${
                          profileVisibility === "private"
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-zinc-600 bg-transparent"
                        }`}
                      >
                        {profileVisibility === "private" && (
                          <View className="size-1.5 rounded-full bg-black" />
                        )}
                      </View>
                      <Text className="text-xs font-bold text-white">Private</Text>
                    </View>
                    <Text className="mt-1 text-[11px] text-zinc-400">
                      Only you can see your record.
                    </Text>
                  </HapticPressable>

                  <HapticPressable
                    className={`flex-1 rounded-2xl border p-3.5 ${
                      profileVisibility === "public"
                        ? "border-emerald-400/60 bg-emerald-400/10"
                        : "border-zinc-800 bg-zinc-950"
                    }`}
                    onPress={() => setProfileVisibility("public")}
                  >
                    <View className="flex-row items-center gap-2">
                      <View
                        className={`size-4 items-center justify-center rounded-full border ${
                          profileVisibility === "public"
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-zinc-600 bg-transparent"
                        }`}
                      >
                        {profileVisibility === "public" && (
                          <View className="size-1.5 rounded-full bg-black" />
                        )}
                      </View>
                      <Text className="text-xs font-bold text-white">Public</Text>
                    </View>
                    <Text className="mt-1 text-[11px] text-zinc-400">
                      Anyone with your profile link.
                    </Text>
                  </HapticPressable>
                </View>
              </GlassCard>

              {/* Action Button */}
              <HapticPressable
                className="flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-4"
                disabled={!usernameValidation.available}
                onPress={handleNextStep}
              >
                <Text className="text-sm font-bold text-zinc-950">
                  Continue to preferences
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#09090b" />
              </HapticPressable>
            </View>
          )}

          {/* ================= STEP 2: PREFERENCES ================= */}
          {step === 2 && (
            <View>
              <Text className="text-[11px] font-bold tracking-[0.16em] text-zinc-500 uppercase">
                STEP 02 · PREFERENCES
              </Text>
              <Text className="mt-1.5 text-3xl font-bold tracking-tight text-white">
                What do you bet on?
              </Text>
              <Text className="mt-2 text-xs leading-5 text-zinc-400">
                Pick the sports you follow most. We&apos;ll tune your live companion
                around the games you actually care about.
              </Text>

              {/* 3-Column Sports Grid */}
              <View className="mt-5 mb-2 flex-row items-center justify-between">
                <Text className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                  Favorite sports
                </Text>
                <Text className="font-mono text-xs font-bold text-emerald-400">
                  {selectedSports.length} SELECTED
                </Text>
              </View>

              <View className="mb-6 flex-row flex-wrap gap-2">
                {SPORTS_LIST.map((sport) => {
                  const isSelected = selectedSports.includes(sport.id);
                  return (
                    <HapticPressable
                      key={sport.id}
                      className={`w-[31.5%] rounded-2xl border p-2.5 ${
                        isSelected
                          ? "border-emerald-400/60 bg-emerald-400/10"
                          : "border-zinc-800 bg-zinc-900/60"
                      }`}
                      onPress={() => toggleSport(sport.id)}
                    >
                      <View className="flex-row items-center justify-between">
                        <Ionicons
                          name={sport.icon}
                          size={18}
                          color={isSelected ? "#34d399" : "#a1a1aa"}
                        />
                        <View
                          className={`size-3.5 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-emerald-400 bg-emerald-400"
                              : "border-zinc-700 bg-transparent"
                          }`}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={10}
                              color="#000000"
                            />
                          )}
                        </View>
                      </View>
                      <Text className="mt-2 text-xs font-bold text-white">
                        {sport.name}
                      </Text>
                      <Text
                        className="mt-0.5 text-[9px] text-zinc-400"
                        numberOfLines={1}
                      >
                        {sport.detail}
                      </Text>
                    </HapticPressable>
                  );
                })}
              </View>

              {/* Stay In The Loop Card (Notifications) */}
              <GlassCard className="mb-5 p-5">
                <Text className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
                  Stay in the loop
                </Text>
                <Text className="mt-1 mb-4 text-xs text-zinc-500">
                  Choose the moments worth interrupting your day for.
                </Text>

                <View className="gap-3">
                  <HapticPressable
                    className="flex-row items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                    onPress={() => {
                      const next = !notifyLegHits;
                      setNotifyLegHits(next);
                      // "One leg away" rides on the same leg_won server
                      // preference, so it cannot outlive leg-hit alerts.
                      if (!next) {
                        setNotifyOneLegAway(false);
                      }
                    }}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons name="checkmark-circle" size={16} color="#34d399" />
                      <Text className="text-xs font-medium text-white">
                        Leg hits
                      </Text>
                    </View>
                    <View
                      className={`size-4 items-center justify-center rounded border ${
                        notifyLegHits
                          ? "border-emerald-400 bg-emerald-400"
                          : "border-zinc-700 bg-transparent"
                      }`}
                    >
                      {notifyLegHits && (
                        <Ionicons name="checkmark" size={12} color="#000000" />
                      )}
                    </View>
                  </HapticPressable>

                  <HapticPressable
                    className="flex-row items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                    onPress={() => {
                      const next = !notifyOneLegAway;
                      // Enabling this implies leg-hit alerts; both persist to
                      // the single leg_won preference.
                      if (next && !notifyLegHits) {
                        setNotifyLegHits(true);
                      }
                      setNotifyOneLegAway(next);
                    }}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons name="flame" size={16} color="#f59e0b" />
                      <View>
                        <Text className="text-xs font-medium text-white">
                          One leg away
                        </Text>
                        {!notifyLegHits ? (
                          <Text className="text-[10px] text-zinc-500">
                            Requires leg hits
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View
                      className={`size-4 items-center justify-center rounded border ${
                        notifyOneLegAway
                          ? "border-emerald-400 bg-emerald-400"
                          : "border-zinc-700 bg-transparent"
                      }`}
                    >
                      {notifyOneLegAway && (
                        <Ionicons name="checkmark" size={12} color="#000000" />
                      )}
                    </View>
                  </HapticPressable>

                  <HapticPressable
                    className="flex-row items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                    onPress={() => setNotifyEmail(!notifyEmail)}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons name="mail" size={16} color="#60a5fa" />
                      <Text className="text-xs font-medium text-white">
                        Email alerts
                      </Text>
                    </View>
                    <View
                      className={`size-4 items-center justify-center rounded border ${
                        notifyEmail
                          ? "border-emerald-400 bg-emerald-400"
                          : "border-zinc-700 bg-transparent"
                      }`}
                    >
                      {notifyEmail && (
                        <Ionicons name="checkmark" size={12} color="#000000" />
                      )}
                    </View>
                  </HapticPressable>
                </View>

                {/* Optional Phone / SMS */}
                <View className="mt-4">
                  <Text className="mb-1 text-xs text-zinc-400">
                    Phone number (optional)
                  </Text>
                  <TextInput
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-white"
                    keyboardType="phone-pad"
                    onChangeText={setPhoneNumber}
                    placeholder="+14155550123"
                    placeholderTextColor="#71717a"
                    style={styles.input}
                    value={phoneNumber}
                  />
                </View>

                <HapticPressable
                  className="mt-3 flex-row items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                  onPress={() => setNotifySms(!notifySms)}
                >
                  <View className="flex-row items-center gap-2.5">
                    <Ionicons
                      name="chatbubble-ellipses"
                      size={16}
                      color="#a1a1aa"
                    />
                    <Text className="text-xs font-medium text-white">
                      SMS alerts <Text className="text-zinc-500">(Pro)</Text>
                    </Text>
                  </View>
                  <View
                    className={`size-4 items-center justify-center rounded border ${
                      notifySms
                        ? "border-emerald-400 bg-emerald-400"
                        : "border-zinc-700 bg-transparent"
                    }`}
                  >
                    {notifySms && (
                      <Ionicons name="checkmark" size={12} color="#000000" />
                    )}
                  </View>
                </HapticPressable>
              </GlassCard>

              {/* Side-by-Side Action Bar */}
              <View className="flex-row gap-3">
                <HapticPressable
                  className="items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3.5"
                  onPress={handleBackStep}
                >
                  <Text className="text-xs font-semibold text-zinc-300">
                    ‹ Back
                  </Text>
                </HapticPressable>
                <HapticPressable
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3.5"
                  onPress={handleNextStep}
                >
                  <Text className="text-sm font-bold text-zinc-950">
                    Continue to plans
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#09090b" />
                </HapticPressable>
              </View>
            </View>
          )}

          {/* ================= STEP 3: MEMBERSHIP PLANS ================= */}
          {step === 3 && (
            <View>
              <Text className="text-[11px] font-bold tracking-[0.16em] text-zinc-500 uppercase">
                STEP 03 · MEMBERSHIP
              </Text>
              <Text className="mt-1.5 text-3xl font-bold tracking-tight text-white">
                Choose your membership
              </Text>
              <Text className="mt-2 text-xs leading-5 text-zinc-400">
                Start free, or unlock the tools that keep up with a serious tracking
                habit. You can change your plan later.
              </Text>

              {/* Active Plan Details Card (Changes dynamically above selector buttons) */}
              <GlassCard
                className={`my-5 p-6 ${
                  selectedPlan === "pro"
                    ? "border-emerald-500/50 bg-emerald-950/20"
                    : selectedPlan === "creator"
                      ? "border-fuchsia-500/50 bg-fuchsia-950/20"
                      : "border-zinc-800 bg-zinc-900/60"
                }`}
                variant="elevated"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`rounded-full px-2.5 py-0.5 ${
                        selectedPlan === "pro"
                          ? "bg-emerald-400 text-black"
                          : selectedPlan === "creator"
                            ? "bg-fuchsia-400 text-black"
                            : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      <Text
                        className={`font-mono text-[10px] font-bold uppercase ${
                          selectedPlan === "free"
                            ? "text-zinc-300"
                            : "text-zinc-950"
                        }`}
                      >
                        {PLANS[selectedPlan].badge}
                      </Text>
                    </View>
                    {PLANS[selectedPlan].popular && (
                      <View className="rounded-full bg-emerald-400/20 px-2 py-0.5">
                        <Text className="text-[9px] font-bold text-emerald-400 uppercase">
                          Most Popular
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="font-mono text-xs text-zinc-500">
                    {PLANS[selectedPlan].num}
                  </Text>
                </View>

                <Text className="mt-4 text-2xl font-bold text-white">
                  {PLANS[selectedPlan].name}
                </Text>
                <Text className="mt-1 text-xs text-zinc-400">
                  {PLANS[selectedPlan].tagline}
                </Text>

                <View className="my-5 flex-row items-baseline gap-1">
                  <Text
                    className={`font-mono text-4xl font-extrabold ${
                      selectedPlan === "pro"
                        ? "text-emerald-400"
                        : selectedPlan === "creator"
                          ? "text-fuchsia-400"
                          : "text-white"
                    }`}
                  >
                    {PLANS[selectedPlan].price}
                  </Text>
                  <Text className="text-xs text-zinc-500">
                    {PLANS[selectedPlan].period}
                  </Text>
                </View>

                {/* Features List */}
                <View className="gap-2.5 border-t border-zinc-800/80 pt-4">
                  {PLANS[selectedPlan].features.map((feat, idx) => (
                    <View key={idx} className="flex-row items-center gap-2.5">
                      <Ionicons
                        name={feat.included ? "checkmark-circle" : "close-circle"}
                        size={16}
                        color={
                          feat.included
                            ? selectedPlan === "creator"
                              ? "#e879f9"
                              : "#34d399"
                            : "#71717a"
                        }
                      />
                      <Text
                        className={`text-xs ${
                          feat.included ? "text-zinc-200" : "text-zinc-500"
                        } ${feat.bold ? "font-bold text-white" : ""}`}
                      >
                        {feat.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </GlassCard>

              {/* 3 Side-by-Side Selector Buttons */}
              <View className="mb-6 flex-row gap-2">
                {(["free", "pro", "creator"] as const).map((key) => {
                  const plan = PLANS[key];
                  const isActive = selectedPlan === key;

                  return (
                    <HapticPressable
                      key={key}
                      className={`flex-1 items-center rounded-2xl border py-3 ${
                        isActive
                          ? key === "pro"
                            ? "border-emerald-400 bg-emerald-400/20"
                            : key === "creator"
                              ? "border-fuchsia-400 bg-fuchsia-400/20"
                              : "border-white bg-zinc-800"
                          : "border-zinc-800 bg-zinc-900/60"
                      }`}
                      onPress={() => setSelectedPlan(key)}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          isActive ? "text-white" : "text-zinc-400"
                        }`}
                      >
                        {plan.name.replace("ParlayPal ", "")}
                      </Text>
                      <Text
                        className={`font-mono text-[11px] ${
                          isActive ? "text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {plan.price}
                      </Text>
                    </HapticPressable>
                  );
                })}
              </View>

              {/* Bottom Side-by-Side Action Bar */}
              <View className="flex-row gap-3">
                <HapticPressable
                  className="items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3.5"
                  onPress={handleBackStep}
                >
                  <Text className="text-xs font-semibold text-zinc-300">
                    ‹ Back
                  </Text>
                </HapticPressable>
                <HapticPressable
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3.5 ${
                    selectedPlan === "creator"
                      ? "bg-fuchsia-500"
                      : "bg-emerald-400"
                  }`}
                  onPress={handleNextStep}
                >
                  <Text
                    className={`text-sm font-bold ${
                      selectedPlan === "creator"
                        ? "text-white"
                        : "text-zinc-950"
                    }`}
                  >
                    {PLANS[selectedPlan].buttonText}
                  </Text>
                </HapticPressable>
              </View>
            </View>
          )}

          {/* ================= STEP 4: READY ================= */}
          {step === 4 && (
            <View className="items-center text-center">
              <View className="mb-4 size-20 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
                <Ionicons name="checkmark" size={36} color="#34d399" />
              </View>

              <Text className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
                STEP 04 · READY
              </Text>
              <Text className="mt-2 text-center text-4xl font-bold tracking-tight text-white">
                You&apos;re all set.
              </Text>
              <Text className="mt-2 text-center text-xs leading-5 text-zinc-400">
                Upload a screenshot of any parlay or single bet slip and we&apos;ll
                turn it into a live tracker in seconds.
              </Text>

              {/* 3 Side-by-Side Feature Cards as requested */}
              <View className="my-6 w-full flex-row gap-2">
                <View className="flex-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 text-left">
                  <Text className="text-base text-emerald-400">✦</Text>
                  <Text className="mt-2 text-xs font-bold text-zinc-100">
                    Upload once
                  </Text>
                  <Text className="mt-1 text-[10px] leading-4 text-zinc-500">
                    Drop in your slip.
                  </Text>
                </View>

                <View className="flex-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 text-left">
                  <Text className="text-base text-emerald-400">◌</Text>
                  <Text className="mt-2 text-xs font-bold text-zinc-100">
                    Track live
                  </Text>
                  <Text className="mt-1 text-[10px] leading-4 text-zinc-500">
                    Follow every leg.
                  </Text>
                </View>

                <View className="flex-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 text-left">
                  <Text className="text-base text-emerald-400">✓</Text>
                  <Text className="mt-2 text-xs font-bold text-zinc-100">
                    Know sooner
                  </Text>
                  <Text className="mt-1 text-[10px] leading-4 text-zinc-500">
                    See what hits.
                  </Text>
                </View>
              </View>

              {/* Primary Action Button */}
              <HapticPressable
                className="w-full flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-4"
                disabled={isFinishing}
                onPress={handleFinishOnboarding}
              >
                <Text className="text-sm font-bold text-zinc-950">
                  {isFinishing ? "Finalizing Account..." : "Go to dashboard"}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#09090b" />
              </HapticPressable>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 16,
  },
});
