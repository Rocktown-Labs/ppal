import { Ionicons } from "@expo/vector-icons";
import { validateUsernameWithBloomFilter } from "@ppal/contracts/bloom-filter";
import { env } from "@ppal/env/native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
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
import { authClient } from "@/lib/auth-client";

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
      { bold: false, included: true, text: "Instant Gemini slip scanning" },
      { bold: false, included: true, text: "Real-time push alerts on hits" },
      { bold: false, included: false, text: "Advanced analytics & trends" },
    ],
    name: "Free",
    num: "01",
    period: "/ forever",
    popular: false,
    price: "$0",
    tagline: "Track your weekend slips.",
  },
  pro: {
    badge: "PRO TRACKER",
    buttonText: "Go Pro →",
    color: "emerald",
    features: [
      { bold: true, included: true, text: "500 tickets / month" },
      { bold: true, included: true, text: "Fast 5-minute game updates" },
      { bold: false, included: true, text: "Instant push & lock-screen alerts" },
      { bold: false, included: true, text: "Historical ROI & market trends" },
    ],
    name: "ParlayPal Pro",
    num: "02",
    period: "/ mo",
    popular: true,
    price: "$12.99",
    tagline: "For active daily bettors.",
  },
  creator: {
    badge: "CREATOR",
    buttonText: "Go Creator →",
    color: "fuchsia",
    features: [
      { bold: true, included: true, text: "1,000 tickets / month" },
      { bold: true, included: true, text: "Bulk screenshot batch import" },
      { bold: false, included: true, text: "Highest priority extraction queue" },
      { bold: false, included: true, text: "Public verified card & syndicate badge" },
    ],
    name: "ParlayPal Creator",
    num: "03",
    period: "/ mo",
    popular: false,
    price: "$24.99",
    tagline: "Built for syndicates & cappers.",
  },
} as const;

type PlanKey = keyof typeof PLANS;

export default function OnboardingScreen() {
  const { completeOnboarding, logout, setPermission, user } = useAppState();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Profile state
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [username, setUsername] = useState("sharp_baller");
  const [profileVisibility, setProfileVisibility] = useState<"private" | "public">("private");

  // Step 2: Preferences & Mobile Push Notifications state
  const [selectedSports, setSelectedSports] = useState<string[]>(["basketball", "football"]);
  const [notifyLegHits, setNotifyLegHits] = useState(true);
  const [notifyOneLegAway, setNotifyOneLegAway] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<
    "granted" | "denied" | "undetermined"
  >("undetermined");

  // Step 3: Plan state
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("free");

  const [isFinishing, setIsFinishing] = useState(false);

  // Check initial notification permission on mount
  useEffect(() => {
    async function checkExistingPerms() {
      if (Platform.OS !== "web") {
        try {
          const { status } = await Notifications.getPermissionsAsync();
          setPushPermissionStatus(
            status === "granted"
              ? "granted"
              : status === "denied"
                ? "denied"
                : "undetermined"
          );
        } catch {
          // Unsupported environment fallback
        }
      }
    }
    void checkExistingPerms();
  }, []);

  // Bloom Filter availability validation for username
  const usernameValidation = useMemo(() => {
    return validateUsernameWithBloomFilter(username);
  }, [username]);

  const toggleSport = (sportId: string) => {
    void Haptics.selectionAsync().catch(() => {});
    setSelectedSports((prev) =>
      prev.includes(sportId) ? prev.filter((id) => id !== sportId) : [...prev, sportId]
    );
  };

  // Exit & Sign Out Confirmation (Apple HIG: Clear wayfinding & agency)
  const handleExitOnboarding = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Sign Out & Exit?",
      "You will be signed out and returned to the sign-in screen. You can sign back in anytime to complete your setup.",
      [
        { style: "cancel", text: "Stay" },
        {
          onPress: async () => {
            await logout();
            router.replace("/(auth)");
          },
          style: "destructive",
          text: "Sign Out",
        },
      ]
    );
  };

  // Avatar Image Picker: direct, zero-latency opening (Apple HIG response)
  const handlePickFromLibrary = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert(
          "Photos Permission Needed",
          "Please allow photo access in Settings so you can choose a profile photo and upload bet slips.",
          [{ text: "OK" }]
        );
        return;
      }
      await setPermission("photos", true);

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Photo Library Error", "Could not access photos. Please try again.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const permResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert(
          "Camera Permission Needed",
          "Please allow camera access in Settings to take a profile photo.",
          [{ text: "OK" }]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Camera Error", "Could not capture photo. Please try again.");
    }
  };

  const registerDeviceToken = async () => {
    if (Platform.OS === "web" || isDemoUser(user)) return;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      if (tokenData?.data) {
        await client.api.v1.me["device-tokens"].$post({
          json: {
            platform: Platform.OS === "ios" ? "ios" : "android",
            token: tokenData.data,
          },
        });
      }
    } catch {
      // Fallback gracefully (e.g. simulator without APNs entitlement)
    }
  };

  // Push Notifications Permission Request
  const requestPushPermission = async () => {
    if (Platform.OS === "web") {
      setPushPermissionStatus("granted");
      await setPermission("notifications", true);
      return true;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";
      setPushPermissionStatus(granted ? "granted" : "denied");
      await setPermission("notifications", granted);
      if (granted) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void registerDeviceToken();
      }
      return granted;
    } catch {
      return false;
    }
  };

  const handleNextStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 1) {
      if (!usernameValidation.available) return;
      setStep(2);
    } else if (step === 2) {
      // If user selected notifications and hasn't answered yet, prompt system dialog
      if ((notifyLegHits || notifyOneLegAway) && pushPermissionStatus === "undetermined") {
        await requestPushPermission();
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleBackStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 1) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleFinishOnboarding = async () => {
    setIsFinishing(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (!isDemoUser(user)) {
      // 1. Upload chosen avatar to server if selected
      if (avatarUri) {
        try {
          const formData = new FormData();
          const filename = avatarUri.split("/").pop() ?? "avatar.jpg";
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : "image/jpeg";
          formData.append("avatar", {
            name: filename,
            type,
            uri: avatarUri,
          } as unknown as Blob);

          const cookie = await authClient.getCookie();
          await fetch(`${env.EXPO_PUBLIC_SERVER_URL}/api/v1/me/avatar`, {
            body: formData,
            headers: cookie ? { cookie } : {},
            method: "POST",
          });
        } catch {
          // Graceful fallback for offline / mock
        }
      }

      // 2. Persist profile handle & push notification preferences
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
            phoneNumber: null,
            pushEnabled: pushPermissionStatus === "granted" || notifyLegHits,
            smsEnabled: false,
            ticketLost: true,
            ticketWon: true,
          },
        }),
      ]);
      void registerDeviceToken();
    }

    await completeOnboarding(selectedSports);
    setIsFinishing(false);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView
      className="flex-1 bg-zinc-950"
      style={{ backgroundColor: "#09090b", flex: 1 }}
    >
      <View className="flex-1 px-5 pt-2">
        {/* Top Stepper Header & Exit/Sign Out Button */}
        <View className="mb-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Text className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
                GET SET UP
              </Text>
              <Text className="font-mono text-xs text-zinc-500">
                · 0{step} / 04
              </Text>
            </View>

            {/* Exit / Sign Out Button */}
            <HapticPressable
              accessibilityLabel="Sign out and exit setup"
              className="flex-row items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 active:bg-zinc-800"
              onPress={handleExitOnboarding}
            >
              <Ionicons name="log-out-outline" size={13} color="#a1a1aa" />
              <Text className="text-xs font-semibold text-zinc-300">
                Sign Out
              </Text>
            </HapticPressable>
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

              {/* Avatar Box with Real Image Selection */}
              <GlassCard className="my-5 items-center p-6 text-center">
                <View className="relative mb-3 size-24 items-center justify-center">
                  <HapticPressable
                    accessibilityLabel="Choose profile photo from library"
                    className="size-full items-center justify-center overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-800/80 active:opacity-90"
                    onPress={handlePickFromLibrary}
                  >
                    {avatarUri ? (
                      <Image
                        className="size-full"
                        resizeMode="cover"
                        source={{ uri: avatarUri }}
                      />
                    ) : (
                      <Ionicons color="#71717a" name="person" size={40} />
                    )}
                  </HapticPressable>

                  {/* Fully visible camera badge with zero clipping */}
                  <HapticPressable
                    accessibilityLabel="Take a photo with camera"
                    className="absolute -right-1 -bottom-1 z-10 size-8 items-center justify-center rounded-full border-2 border-zinc-950 bg-emerald-400 shadow-md active:bg-emerald-300"
                    onPress={handleTakePhoto}
                  >
                    <Ionicons
                      color="#000000"
                      name="camera"
                      size={14}
                    />
                  </HapticPressable>
                </View>

                <Text className="text-sm font-semibold text-white">
                  {avatarUri ? "Profile photo set" : "Add a profile photo"}
                </Text>
                <Text className="mt-1 text-center text-xs text-zinc-400">
                  {avatarUri
                    ? "Tap the circle to change photo, or camera to retake."
                    : "A photo makes your profile easier for friends to recognize."}
                </Text>

                <View className="mt-3.5 flex-row gap-2">
                  <HapticPressable
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2"
                    onPress={handlePickFromLibrary}
                  >
                    <Text className="text-xs font-semibold text-zinc-200">
                      {avatarUri ? "Change photo" : "Choose image"}
                    </Text>
                  </HapticPressable>
                  <HapticPressable
                    accessibilityLabel="Take photo with camera"
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2"
                    onPress={handleTakePhoto}
                  >
                    <Ionicons color="#e4e4e7" name="camera-outline" size={16} />
                  </HapticPressable>
                  {avatarUri && (
                    <HapticPressable
                      className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2"
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setAvatarUri(null);
                      }}
                    >
                      <Text className="text-xs font-semibold text-rose-400">
                        Remove
                      </Text>
                    </HapticPressable>
                  )}
                </View>
                <Text className="mt-2 text-[10px] text-zinc-500">
                  Optional · Camera or Photos · JPG, PNG, or WebP
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
                    className="flex-1 px-2 py-2.5 text-sm text-white"
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
                          color="#34d399"
                          name="checkmark-circle"
                          size={12}
                        />
                        <Text className="text-[10px] font-bold text-emerald-400">
                          Available
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5">
                        <Ionicons
                          color="#fb7185"
                          name="alert-circle"
                          size={12}
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

                {/* Who can see your record */}
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

              {/* Side-by-Side Action Bar: Continue to preferences + Exit */}
              <View className="flex-row gap-3">
                <HapticPressable
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3.5 active:bg-emerald-300"
                  disabled={!usernameValidation.available}
                  onPress={handleNextStep}
                >
                  <Text className="text-sm font-bold text-zinc-950">
                    Continue to preferences
                  </Text>
                  <Ionicons color="#09090b" name="arrow-forward" size={16} />
                </HapticPressable>

                <HapticPressable
                  accessibilityLabel="Exit setup and sign out"
                  className="items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-3.5 active:bg-zinc-800"
                  onPress={handleExitOnboarding}
                >
                  <Text className="text-xs font-semibold text-zinc-300">Exit</Text>
                </HapticPressable>
              </View>
            </View>
          )}

          {/* ================= STEP 2: PREFERENCES & PUSH NOTIFICATIONS ================= */}
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
                      className={`w-[31.5%] rounded-2xl border p-2.5 ${
                        isSelected
                          ? "border-emerald-400/60 bg-emerald-400/10"
                          : "border-zinc-800 bg-zinc-900/60"
                      }`}
                      key={sport.id}
                      onPress={() => toggleSport(sport.id)}
                    >
                      <View className="flex-row items-center justify-between">
                        <Ionicons
                          color={isSelected ? "#34d399" : "#a1a1aa"}
                          name={sport.icon}
                          size={18}
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
                              color="#000000"
                              name="checkmark"
                              size={10}
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

              {/* Mobile-Native Push Notifications Card */}
              <GlassCard className="mb-5 p-5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2.5">
                    <View className="size-8 items-center justify-center rounded-xl bg-emerald-500/10">
                      <Ionicons color="#34d399" name="notifications" size={18} />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-white">
                        Live Push Alerts
                      </Text>
                      <Text className="text-[11px] text-zinc-400">
                        Instant native lock-screen updates
                      </Text>
                    </View>
                  </View>

                  {pushPermissionStatus === "granted" ? (
                    <View className="flex-row items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1">
                      <Ionicons color="#34d399" name="checkmark-circle" size={12} />
                      <Text className="text-[10px] font-bold text-emerald-400">
                        Enabled
                      </Text>
                    </View>
                  ) : pushPermissionStatus === "denied" ? (
                    <View className="flex-row items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1">
                      <Ionicons color="#f59e0b" name="warning" size={12} />
                      <Text className="text-[10px] font-bold text-amber-400">
                        Off
                      </Text>
                    </View>
                  ) : (
                    <HapticPressable
                      className="rounded-full bg-emerald-400 px-3 py-1.5 active:bg-emerald-300"
                      onPress={requestPushPermission}
                    >
                      <Text className="text-[11px] font-bold text-black">
                        Enable
                      </Text>
                    </HapticPressable>
                  )}
                </View>

                {pushPermissionStatus !== "granted" && (
                  <View className="mt-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
                    <Text className="text-xs leading-4 text-zinc-400">
                      Push notifications are free and real-time. Know the second your
                      player hits their line without refreshing the app.
                    </Text>
                    {pushPermissionStatus === "denied" && (
                      <Text className="mt-1.5 text-[11px] text-amber-400">
                        Notifications disabled in device settings. You can re-enable anytime in iOS Settings &gt; ParlayPal.
                      </Text>
                    )}
                  </View>
                )}

                <View className="mt-4 gap-2.5 border-t border-zinc-800/80 pt-4">
                  <HapticPressable
                    className="flex-row items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                    onPress={() => {
                      const next = !notifyLegHits;
                      setNotifyLegHits(next);
                      if (!next) {
                        setNotifyOneLegAway(false);
                      }
                    }}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons color="#34d399" name="checkmark-circle" size={16} />
                      <View>
                        <Text className="text-xs font-medium text-white">
                          Leg hit alerts
                        </Text>
                        <Text className="text-[10px] text-zinc-500">
                          Instant buzz when a player clears a line
                        </Text>
                      </View>
                    </View>
                    <View
                      className={`size-4 items-center justify-center rounded border ${
                        notifyLegHits
                          ? "border-emerald-400 bg-emerald-400"
                          : "border-zinc-700 bg-transparent"
                      }`}
                    >
                      {notifyLegHits && (
                        <Ionicons color="#000000" name="checkmark" size={12} />
                      )}
                    </View>
                  </HapticPressable>

                  <HapticPressable
                    className="flex-row items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                    onPress={() => {
                      const next = !notifyOneLegAway;
                      if (next && !notifyLegHits) {
                        setNotifyLegHits(true);
                      }
                      setNotifyOneLegAway(next);
                    }}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons color="#f59e0b" name="flame" size={16} />
                      <View>
                        <Text className="text-xs font-medium text-white">
                          One leg away sweat alerts
                        </Text>
                        <Text className="text-[10px] text-zinc-500">
                          Heads up when your parlay is down to the final leg
                        </Text>
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
                        <Ionicons color="#000000" name="checkmark" size={12} />
                      )}
                    </View>
                  </HapticPressable>

                  <HapticPressable
                    className="flex-row items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                    onPress={() => setNotifyEmail(!notifyEmail)}
                  >
                    <View className="flex-row items-center gap-2.5">
                      <Ionicons color="#60a5fa" name="mail" size={16} />
                      <View>
                        <Text className="text-xs font-medium text-white">
                          Weekly email recap
                        </Text>
                        <Text className="text-[10px] text-zinc-500">
                          Digest of settled slips & hit rates
                        </Text>
                      </View>
                    </View>
                    <View
                      className={`size-4 items-center justify-center rounded border ${
                        notifyEmail
                          ? "border-emerald-400 bg-emerald-400"
                          : "border-zinc-700 bg-transparent"
                      }`}
                    >
                      {notifyEmail && (
                        <Ionicons color="#000000" name="checkmark" size={12} />
                      )}
                    </View>
                  </HapticPressable>
                </View>
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
                  <Ionicons color="#09090b" name="arrow-forward" size={16} />
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
                Start free, or unlock higher tracking volume and faster live game
                syncing. You can change your plan anytime.
              </Text>

              {/* Active Plan Details Card */}
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
                    <View className="flex-row items-center gap-2.5" key={idx}>
                      <Ionicons
                        color={
                          feat.included
                            ? selectedPlan === "creator"
                              ? "#e879f9"
                              : "#34d399"
                            : "#71717a"
                        }
                        name={feat.included ? "checkmark-circle" : "close-circle"}
                        size={16}
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
                      className={`flex-1 items-center rounded-2xl border py-3 ${
                        isActive
                          ? key === "pro"
                            ? "border-emerald-400 bg-emerald-400/20"
                            : key === "creator"
                              ? "border-fuchsia-400 bg-fuchsia-400/20"
                              : "border-white bg-zinc-800"
                          : "border-zinc-800 bg-zinc-900/60"
                      }`}
                      key={key}
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
                <Ionicons color="#34d399" name="checkmark" size={36} />
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

              {/* 3 Side-by-Side Feature Cards */}
              <View className="my-6 w-full flex-row gap-2">
                <View className="flex-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 text-left">
                  <Text className="text-base text-emerald-400">✦</Text>
                  <Text className="mt-2 text-xs font-bold text-zinc-100">
                    Drop in slips
                  </Text>
                  <Text className="mt-1 text-[10px] leading-4 text-zinc-500">
                    Instant AI extraction.
                  </Text>
                </View>

                <View className="flex-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 text-left">
                  <Text className="text-base text-emerald-400">◌</Text>
                  <Text className="mt-2 text-xs font-bold text-zinc-100">
                    Live tracking
                  </Text>
                  <Text className="mt-1 text-[10px] leading-4 text-zinc-500">
                    Play-by-play companion.
                  </Text>
                </View>

                <View className="flex-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3.5 text-left">
                  <Text className="text-base text-emerald-400">🔔</Text>
                  <Text className="mt-2 text-xs font-bold text-zinc-100">
                    Push alerts
                  </Text>
                  <Text className="mt-1 text-[10px] leading-4 text-zinc-500">
                    Buzz when legs hit.
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
                <Ionicons color="#09090b" name="arrow-forward" size={16} />
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
    fontSize: 16, // mobile-native requirement: >= 16px to prevent iOS auto-zoom
  },
});
