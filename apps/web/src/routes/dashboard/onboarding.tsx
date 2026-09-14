import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { consumeReferralIntent } from "@/lib/referral-intent";

const SPORTS_LIST = [
  {
    detail: "NBA · WNBA · NCAA",
    icon: "🏀",
    id: "basketball",
    name: "Basketball",
  },
  { detail: "NFL · NCAA", icon: "🏈", id: "football", name: "Football" },
  { detail: "MLB", icon: "⚾", id: "baseball", name: "Baseball" },
  { detail: "NHL", icon: "🏒", id: "hockey", name: "Hockey" },
  { detail: "International", icon: "⚽", id: "soccer", name: "Soccer" },
  { detail: "UFC", icon: "🥊", id: "mma", name: "MMA" },
  { detail: "ATP · WTA", icon: "🎾", id: "tennis", name: "Tennis" },
  { detail: "NASCAR · F1", icon: "🏎️", id: "racing", name: "Racing" },
  { detail: "PGA Tour", icon: "⛳", id: "golf", name: "Golf" },
] as const;

interface OnboardingFormValues {
  avatarUrl: string | null;
  billingPeriod: "monthly" | "yearly";
  notifyEmail: boolean;
  notifyLegWon: boolean;
  notifyOneLegAway: boolean;
  profileVisibility: "private" | "public";
  selectedPlan: "creator" | "free" | "pro";
  selectedSports: string[];
  username: string;
}

const ONBOARDING_STEPS = [
  { eyebrow: "Profile", label: "Create profile", number: 1 },
  { eyebrow: "Preferences", label: "Preferences", number: 2 },
  { eyebrow: "Membership", label: "Choose plan", number: 3 },
  { eyebrow: "Ready", label: "First slip", number: 4 },
] as const;

const OnboardingWizardComponent = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const initialValues: OnboardingFormValues = {
    avatarUrl: null,
    billingPeriod: "monthly",
    notifyEmail: true,
    notifyLegWon: true,
    notifyOneLegAway: true,
    profileVisibility: "private",
    selectedPlan: "free",
    selectedSports: ["basketball", "football"],
    username: "",
  };

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: () => {
      void navigate({ to: "/dashboard" });
    },
  });

  useEffect(() => {
    let active = true;
    const loadExistingProfile = async () => {
      try {
        const { user } = await api.community.getMe();
        if (active && user?.profile) {
          if (user.profile.username) {
            form.setFieldValue("username", user.profile.username);
          }
          form.setFieldValue(
            "profileVisibility",
            user.profile.isPublic ? "public" : "private"
          );
        }
      } catch {
        // Unauthenticated or not yet created
      }
    };
    void loadExistingProfile();
    return () => {
      active = false;
    };
  }, [form]);

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Choose a JPG, PNG, or WebP image no larger than 5MB");
      e.target.value = "";
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const { url } = await api.community.uploadAvatar(file);
      form.setFieldValue("avatarUrl", url);
      toast.success("Avatar uploaded successfully!");
      setIsUploadingAvatar(false);
    } catch (error) {
      setIsUploadingAvatar(false);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload avatar"
      );
    }
  };

  const handleStep1Continue = async () => {
    setUsernameError(null);
    const usernameVal = form.getFieldValue("username").trim();
    const visibilityVal = form.getFieldValue("profileVisibility");

    if (!usernameVal) {
      const msg = "Please enter a username to complete your profile.";
      setUsernameError(msg);
      toast.error(msg);
      return;
    }

    const valid = /^[a-z0-9_]{3,30}$/iu.test(usernameVal);
    if (!valid) {
      const msg =
        "Username must be 3–30 characters and contain only letters, numbers, and underscores.";
      setUsernameError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.community.updateMe({
        isPublic: visibilityVal === "public",
        username: usernameVal.toLowerCase(),
      });

      const pendingReferral = consumeReferralIntent();
      if (pendingReferral) {
        try {
          await api.referrals.claim(pendingReferral);
        } catch {
          // The explicit referral intent is single-use even when unclaimable.
        }
      }

      setIsSubmitting(false);
      setStep(2);
    } catch (error) {
      setIsSubmitting(false);
      const message =
        error instanceof Error ? error.message : "Failed to save username";
      setUsernameError(message);
      toast.error(message);
    }
  };

  const handleStep2Continue = async () => {
    setIsSubmitting(true);
    try {
      await api.notifications.updateSettings({
        emailEnabled: form.getFieldValue("notifyEmail"),
        inAppEnabled: true,
        legLost: form.getFieldValue("notifyOneLegAway"),
        legWon: form.getFieldValue("notifyLegWon"),
        pushEnabled: true,
        ticketLost: true,
        ticketWon: true,
      });
      setIsSubmitting(false);
      setStep(3);
    } catch {
      // Preferences update failure shouldn't block onboarding progress
      setIsSubmitting(false);
      setStep(3);
    }
  };

  const handleSelectPlan = async (plan: "creator" | "free" | "pro") => {
    form.setFieldValue("selectedPlan", plan);
    if (plan === "free") {
      setStep(4);
      return;
    }
    setIsSubmitting(true);
    try {
      const { origin } = window.location;
      const checkout = await authClient.subscription.upgrade({
        annual: form.getFieldValue("billingPeriod") === "yearly",
        cancelUrl: `${origin}/dashboard/onboarding`,
        plan,
        successUrl: `${origin}/dashboard`,
      });
      if (checkout.error) {
        toast.error(checkout.error.message ?? "Checkout could not be started");
        setIsSubmitting(false);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Checkout could not be started"
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[minmax(24rem,0.86fr)_minmax(0,1.14fr)]">
      {/* Desktop Left Aside Branding & Live Tracker */}
      <aside className="relative hidden min-h-svh overflow-hidden border-e border-white/10 bg-[#111413] text-white lg:flex">
        <div className="relative flex min-h-svh w-full flex-col p-8 sm:p-10 xl:p-14">
          <Link to="/" className="inline-flex w-fit items-center">
            <img
              src="/images/logo.png"
              alt="ParlayPal"
              className="h-16 w-auto object-contain"
            />
          </Link>

          <div className="my-auto flex w-full max-w-xl flex-col justify-center py-12 xl:py-20">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-emerald-300 uppercase">
              <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              Your live betting desk
            </div>
            <h1 className="max-w-lg text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-white xl:text-6xl">
              Follow every leg.
              <br />
              <span className="text-emerald-400">Know when it hits.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-zinc-400 xl:text-lg">
              Upload your betting slip and let ParlayPal track every leg live —
              predictions, progress, and results without the noise.
            </p>

            {/* Live Tracker Preview Card */}
            <div className="relative mt-10 max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm xl:mt-14">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-500 uppercase">
                    Live tracker
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-white">
                    Tonight&apos;s card
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>

              <div className="mt-7 grid grid-cols-[1fr_auto] items-end gap-6">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                    5-leg parlay
                  </p>
                  <div
                    className="mt-3 flex h-16 items-end gap-1.5"
                    aria-hidden="true"
                  >
                    <span className="h-6 flex-1 rounded-t bg-emerald-400/40" />
                    <span className="h-10 flex-1 rounded-t bg-emerald-400/60" />
                    <span className="h-8 flex-1 rounded-t bg-emerald-400/50" />
                    <span className="h-14 flex-1 rounded-t bg-emerald-400" />
                    <span className="h-11 flex-1 rounded-t bg-emerald-400/70" />
                    <span className="h-16 flex-1 rounded-t bg-emerald-300" />
                    <span className="h-12 flex-1 rounded-t bg-emerald-400/80" />
                    <span className="h-9 flex-1 rounded-t bg-emerald-400/50" />
                    <span className="h-14 flex-1 rounded-t bg-emerald-400/70" />
                    <span className="h-10 flex-1 rounded-t bg-emerald-400/50" />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold tracking-[-0.05em] text-white">
                    3<span className="text-zinc-600">/</span>5
                  </p>
                  <p className="mt-1 text-[10px] font-semibold tracking-[0.16em] text-emerald-300 uppercase">
                    legs hit
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-xs">
                <div className="rounded-xl bg-white/5 px-3 py-2.5">
                  <p className="text-zinc-500">Next up</p>
                  <p className="mt-1 font-semibold text-zinc-200">LAL @ BOS</p>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2.5">
                  <p className="text-zinc-500">Status</p>
                  <p className="mt-1 font-semibold text-emerald-300">On pace</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-zinc-500">
            <span>Built for the sweat.</span>
            <span className="font-mono tracking-[0.16em] text-zinc-600 uppercase">
              PP / 01
            </span>
          </div>
        </div>
      </aside>

      {/* Main Wizard Content */}
      <main className="relative min-h-svh overflow-y-auto bg-neutral-950">
        <div className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10 lg:px-12 xl:px-16">
          <Link to="/" className="inline-flex w-fit self-center lg:hidden">
            <img
              src="/images/logo.png"
              alt="ParlayPal"
              className="h-14 w-auto object-contain"
            />
            <span className="sr-only">ParlayPal</span>
          </Link>

          <div className="my-auto flex flex-col gap-8 py-6 sm:gap-10 sm:py-10 lg:py-12">
            {/* Header & Step Tracker */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
                  Get set up
                </p>
                <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-zinc-600 uppercase">
                  0{step} / 04
                </p>
              </div>

              <nav
                aria-label="Onboarding progress"
                className="grid grid-cols-4 gap-2 border-b border-white/10 pb-5"
              >
                {ONBOARDING_STEPS.map((onboardingStep, idx) => (
                  <div
                    key={onboardingStep.number}
                    className="flex min-w-0 items-center gap-2 sm:gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                          step >= onboardingStep.number
                            ? "border-emerald-400 bg-emerald-400 text-black shadow-md shadow-emerald-500/20"
                            : "border-white/10 bg-white/5 text-zinc-500"
                        } ${
                          step === onboardingStep.number
                            ? "ring-4 ring-emerald-400/10"
                            : ""
                        }`}
                      >
                        {step > onboardingStep.number ? (
                          <Check className="size-4 stroke-[2.5]" />
                        ) : (
                          onboardingStep.number
                        )}
                      </span>
                      <span
                        className={`hidden min-w-0 truncate text-xs font-semibold sm:block ${
                          step === onboardingStep.number
                            ? "text-white"
                            : "text-zinc-500"
                        }`}
                      >
                        {onboardingStep.label}
                      </span>
                    </div>
                    {idx < ONBOARDING_STEPS.length - 1 ? (
                      <span
                        className={`h-px min-w-2 flex-1 ${
                          step > onboardingStep.number
                            ? "bg-emerald-400/60"
                            : "bg-white/10"
                        }`}
                      />
                    ) : null}
                  </div>
                ))}
              </nav>
            </div>

            {/* STEP 1: Profile Setup */}
            {step === 1 && (
              <section
                aria-labelledby="profile-step-title"
                className="flex flex-col gap-8"
              >
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                    Step 01 · Profile
                  </p>
                  <h2
                    id="profile-step-title"
                    className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
                  >
                    Set up your profile
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                    Choose how you want to show up in the community. Your
                    betting record stays private unless you decide to publish
                    it.
                  </p>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
                  {/* Avatar Card */}
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <div className="relative">
                        <div className="flex size-28 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-500">
                          <Camera className="size-10 stroke-[1.5]" />
                        </div>
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                            <Loader2 className="size-6 animate-spin text-emerald-400" />
                          </div>
                        )}
                        <span
                          aria-hidden="true"
                          className="absolute right-1 bottom-1 flex size-7 items-center justify-center rounded-full border-4 border-[#111413] bg-emerald-400 text-black"
                        >
                          <Check className="size-3.5 stroke-[3]" />
                        </span>
                      </div>

                      <p className="mt-5 text-sm font-semibold text-white">
                        Add a profile photo
                      </p>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-500">
                        A photo makes your public profile easier for friends to
                        recognize.
                      </p>

                      <label
                        htmlFor="avatar-upload-input"
                        className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-zinc-200 transition hover:border-emerald-400/50 hover:bg-emerald-400/10 hover:text-emerald-300"
                      >
                        <span>
                          {isUploadingAvatar ? "Uploading..." : "Choose image"}
                        </span>
                        <input
                          id="avatar-upload-input"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          disabled={isUploadingAvatar}
                          onChange={handleAvatarFileChange}
                          type="file"
                        />
                      </label>
                      <p className="mt-4 text-[11px] text-zinc-600">
                        Optional · JPG, PNG, or WebP · 5MB max
                      </p>
                    </div>
                  </div>

                  {/* Username & Privacy Card */}
                  <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
                    <form.Field
                      name="username"
                      validators={{
                        onChange: ({ value }) => {
                          if (!value.trim()) {
                            return "Username is required to complete profile onboarding";
                          }
                          if (!/^[a-z0-9_]{3,30}$/iu.test(value)) {
                            return "3–30 characters, letters, numbers, and underscores only";
                          }
                        },
                      }}
                    >
                      {(field) => (
                        <div>
                          <label
                            htmlFor="username-input"
                            className="block text-xs font-bold tracking-[0.16em] text-zinc-400 uppercase"
                          >
                            Username <span className="text-emerald-400">*</span>
                          </label>
                          <p className="mt-2 text-xs leading-5 text-zinc-500">
                            This is the handle people will see if you share your
                            record.
                          </p>
                          <div className="mt-3 flex items-center rounded-2xl border border-white/10 bg-black/20 px-4 transition focus-within:border-emerald-400/70 focus-within:ring-4 focus-within:ring-emerald-400/10">
                            <span className="text-base text-zinc-600">@</span>
                            <input
                              id="username-input"
                              type="text"
                              maxLength={30}
                              autoComplete="off"
                              spellCheck="false"
                              placeholder="sharp_baller"
                              className="h-12 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-white placeholder-zinc-600 outline-none focus:ring-0"
                              value={field.state.value}
                              onChange={(e) => {
                                const sanitized = e.target.value
                                  .toLowerCase()
                                  .replaceAll(/[^a-z0-9_]/gu, "");
                                field.handleChange(sanitized);
                                if (usernameError) {
                                  setUsernameError(null);
                                }
                              }}
                            />
                          </div>
                          {field.state.meta.errors.length > 0 && (
                            <p className="mt-2 text-xs text-rose-400">
                              {field.state.meta.errors[0]}
                            </p>
                          )}
                          {usernameError && (
                            <p className="mt-2 text-xs text-rose-400">
                              {usernameError}
                            </p>
                          )}
                          <p className="mt-2 text-xs leading-5 text-zinc-600">
                            Required · 3–30 characters · letters, numbers, and
                            underscores.
                          </p>
                        </div>
                      )}
                    </form.Field>

                    <form.Field name="profileVisibility">
                      {(field) => (
                        <div>
                          <p className="text-xs font-bold tracking-[0.16em] text-zinc-400 uppercase">
                            Who can see your record?
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => field.handleChange("private")}
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition ${
                                field.state.value === "private"
                                  ? "border-emerald-400/60 bg-emerald-400/10 shadow-lg shadow-emerald-500/5"
                                  : "border-white/10 bg-black/20 hover:border-white/20"
                              }`}
                            >
                              <div
                                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                                  field.state.value === "private"
                                    ? "border-emerald-400 bg-emerald-400 text-black"
                                    : "border-zinc-700 bg-transparent"
                                }`}
                              >
                                {field.state.value === "private" && (
                                  <div className="size-1.5 rounded-full bg-black" />
                                )}
                              </div>
                              <div>
                                <span className="block text-sm font-semibold text-white">
                                  Private
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                  Only you can see your record.
                                </span>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => field.handleChange("public")}
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition ${
                                field.state.value === "public"
                                  ? "border-emerald-400/60 bg-emerald-400/10 shadow-lg shadow-emerald-500/5"
                                  : "border-white/10 bg-black/20 hover:border-white/20"
                              }`}
                            >
                              <div
                                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                                  field.state.value === "public"
                                    ? "border-emerald-400 bg-emerald-400 text-black"
                                    : "border-zinc-700 bg-transparent"
                                }`}
                              >
                                {field.state.value === "public" && (
                                  <div className="size-1.5 rounded-full bg-black" />
                                )}
                              </div>
                              <div>
                                <span className="block text-sm font-semibold text-white">
                                  Public
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                                  Anyone with your profile link.
                                </span>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </form.Field>
                  </div>
                </div>

                <div className="flex justify-end border-t border-white/10 pt-6">
                  <button
                    type="button"
                    disabled={isSubmitting || isUploadingAvatar}
                    onClick={handleStep1Continue}
                    className="flex h-12 cursor-pointer items-center justify-center rounded-xl bg-emerald-400 px-6 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 disabled:opacity-50"
                  >
                    <span>
                      {isSubmitting ? "Saving..." : "Continue to preferences"}
                    </span>
                    <ChevronRight className="ml-2 size-4 stroke-[2.5]" />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 2: Preferences */}
            {step === 2 && (
              <section
                aria-labelledby="preferences-step-title"
                className="flex flex-col gap-8"
              >
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                    Step 02 · Preferences
                  </p>
                  <h2
                    id="preferences-step-title"
                    className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
                  >
                    What do you bet on?
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                    Pick the sports you follow most. We’ll tune your live
                    companion around the games you actually care about.
                  </p>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]">
                  {/* Sports Selection Card */}
                  <form.Field name="selectedSports">
                    {(field) => {
                      const currentSports = field.state.value;
                      const toggleSportItem = (sportId: string) => {
                        const updated = currentSports.includes(sportId)
                          ? currentSports.filter((s) => s !== sportId)
                          : [...currentSports, sportId];
                        field.handleChange(updated);
                      };

                      return (
                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                Favorite sports
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                Select all that apply.
                              </p>
                            </div>
                            <span className="font-mono text-[11px] tracking-[0.15em] text-emerald-400 uppercase">
                              {currentSports.length} selected
                            </span>
                          </div>

                          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {SPORTS_LIST.map((sport) => {
                              const isSelected = currentSports.includes(
                                sport.id
                              );
                              return (
                                <button
                                  key={sport.id}
                                  type="button"
                                  onClick={() => toggleSportItem(sport.id)}
                                  className={`group flex min-h-20 cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 text-left transition ${
                                    isSelected
                                      ? "border-emerald-400/60 bg-emerald-400/10 shadow-lg shadow-emerald-500/5"
                                      : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.05]"
                                  }`}
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <span
                                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl transition ${
                                        isSelected
                                          ? "grayscale-0"
                                          : "grayscale group-hover:grayscale-0"
                                      }`}
                                    >
                                      {sport.icon}
                                    </span>
                                    <span className="min-w-0">
                                      <span
                                        className={`block truncate text-sm font-semibold ${
                                          isSelected
                                            ? "text-white"
                                            : "text-zinc-300"
                                        }`}
                                      >
                                        {sport.name}
                                      </span>
                                      <span className="mt-1 block truncate text-[11px] text-zinc-600">
                                        {sport.detail}
                                      </span>
                                    </span>
                                  </span>
                                  <span
                                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition ${
                                      isSelected
                                        ? "border-emerald-400 bg-emerald-400 text-black"
                                        : "border-white/20 text-transparent"
                                    }`}
                                  >
                                    <Check className="size-3 stroke-[3]" />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }}
                  </form.Field>

                  {/* Notifications Preferences Card */}
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Stay in the loop
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        Choose the moments worth interrupting your day for.
                      </p>
                    </div>

                    <div className="mt-5 flex flex-col gap-3">
                      <form.Field name="notifyLegWon">
                        {(field) => (
                          <label
                            aria-label="Notify when a leg hits"
                            htmlFor="notify-leg-won"
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20"
                          >
                            <span className="flex items-center gap-3">
                              <span className="text-base">✅</span>
                              <span className="text-xs font-semibold text-zinc-300">
                                Leg hits
                              </span>
                            </span>
                            <input
                              id="notify-leg-won"
                              type="checkbox"
                              checked={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.checked)
                              }
                              className="size-4 cursor-pointer accent-emerald-400"
                            />
                          </label>
                        )}
                      </form.Field>

                      <form.Field name="notifyOneLegAway">
                        {(field) => (
                          <label
                            aria-label="Notify when one leg away"
                            htmlFor="notify-one-leg-away"
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20"
                          >
                            <span className="flex items-center gap-3">
                              <span className="text-base">🔥</span>
                              <span className="text-xs font-semibold text-zinc-300">
                                One leg away
                              </span>
                            </span>
                            <input
                              id="notify-one-leg-away"
                              type="checkbox"
                              checked={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.checked)
                              }
                              className="size-4 cursor-pointer accent-emerald-400"
                            />
                          </label>
                        )}
                      </form.Field>

                      <form.Field name="notifyEmail">
                        {(field) => (
                          <label
                            aria-label="Notify via email alerts"
                            htmlFor="notify-email"
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-white/20"
                          >
                            <span className="flex items-center gap-3">
                              <span className="text-base">📧</span>
                              <span className="text-xs font-semibold text-zinc-300">
                                Email alerts{" "}
                                <span className="text-zinc-600">(Pro)</span>
                              </span>
                            </span>
                            <input
                              id="notify-email"
                              type="checkbox"
                              checked={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.checked)
                              }
                              className="size-4 cursor-pointer accent-emerald-400"
                            />
                          </label>
                        )}
                      </form.Field>
                    </div>

                    <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                      <p className="text-xs font-semibold text-emerald-300">
                        You’re in control
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-emerald-200/50">
                        Change these preferences anytime from Settings.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-500 transition hover:text-white"
                  >
                    <ChevronLeft className="size-4 stroke-[2]" />
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleStep2Continue}
                    className="flex h-12 cursor-pointer items-center justify-center rounded-xl bg-emerald-400 px-6 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 disabled:opacity-50"
                  >
                    <span>
                      {isSubmitting ? "Saving..." : "Continue to plans"}
                    </span>
                    <ChevronRight className="ml-2 size-4 stroke-[2.5]" />
                  </button>
                </div>
              </section>
            )}

            {/* STEP 3: Membership Plan */}
            {step === 3 && (
              <section
                aria-labelledby="plan-step-title"
                className="flex flex-col gap-8"
              >
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500 uppercase">
                    Step 03 · Membership
                  </p>
                  <h2
                    id="plan-step-title"
                    className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl"
                  >
                    Choose your membership
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                    Start free, or unlock the tools that keep up with a serious
                    tracking habit. You can change your plan later.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {/* Starter / Free */}
                  <div className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-zinc-400 uppercase">
                        Starter
                      </span>
                      <span className="font-mono text-[10px] text-zinc-600">
                        01
                      </span>
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                      Free
                    </h3>
                    <p className="mt-2 text-sm text-zinc-500">
                      A clean place to start.
                    </p>
                    <p className="mt-7 text-4xl font-semibold tracking-[-0.06em] text-white">
                      $0{" "}
                      <span className="text-xs font-normal tracking-normal text-zinc-600">
                        / forever
                      </span>
                    </p>
                    <ul className="mt-7 flex flex-1 flex-col gap-3 border-t border-white/10 pt-6 text-xs text-zinc-400">
                      <li className="flex gap-2.5">
                        <span className="text-zinc-500">✓</span>5 tracked
                        tickets / mo
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-zinc-500">✓</span>Real-time in-app
                        updates
                      </li>
                      <li className="flex gap-2.5 text-zinc-600">
                        <span>×</span>Basic analytics only
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleSelectPlan("free")}
                      className="mt-8 h-11 w-full cursor-pointer rounded-xl border border-white/15 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                    >
                      Continue free
                    </button>
                  </div>

                  {/* Pro Tracker */}
                  <div className="relative flex flex-col rounded-3xl border border-emerald-400/60 bg-emerald-400/[0.07] p-5 shadow-2xl shadow-emerald-500/10 sm:p-6">
                    <span className="absolute -top-3 left-5 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black tracking-[0.14em] text-black uppercase shadow-lg shadow-emerald-500/20">
                      Most popular
                    </span>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-emerald-300 uppercase">
                        Pro tracker
                      </span>
                      <span className="font-mono text-[10px] text-emerald-400/50">
                        02
                      </span>
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                      ParlayPal Pro
                    </h3>
                    <p className="mt-2 text-sm text-emerald-100/50">
                      More volume. More signal.
                    </p>
                    <p className="mt-7 text-4xl font-semibold tracking-[-0.06em] text-emerald-300">
                      $12.99{" "}
                      <span className="text-xs font-normal tracking-normal text-emerald-100/40">
                        / mo
                      </span>
                    </p>
                    <ul className="mt-7 flex flex-1 flex-col gap-3 border-t border-emerald-400/15 pt-6 text-xs text-zinc-300">
                      <li className="flex gap-2.5">
                        <span className="text-emerald-300">✓</span>
                        <strong>500 tickets / month</strong>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-emerald-300">✓</span>Fast 5-minute
                        game updates
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-emerald-300">✓</span>Full
                        analytics & email alerts
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleSelectPlan("pro")}
                      className="mt-8 flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-emerald-400 text-sm font-bold text-black shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-300"
                    >
                      Go Pro <span className="ml-1">→</span>
                    </button>
                  </div>

                  {/* Creator */}
                  <div className="relative flex flex-col rounded-3xl border border-fuchsia-400/50 bg-fuchsia-400/[0.07] p-5 shadow-2xl shadow-fuchsia-500/10 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-fuchsia-400/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-fuchsia-300 uppercase">
                        Creator
                      </span>
                      <span className="font-mono text-[10px] text-fuchsia-400/50">
                        03
                      </span>
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                      ParlayPal Creator
                    </h3>
                    <p className="mt-2 text-sm text-fuchsia-100/50">
                      Built for the full card.
                    </p>
                    <p className="mt-7 text-4xl font-semibold tracking-[-0.06em] text-fuchsia-300">
                      $24.99{" "}
                      <span className="text-xs font-normal tracking-normal text-fuchsia-100/40">
                        / mo
                      </span>
                    </p>
                    <ul className="mt-7 flex flex-1 flex-col gap-3 border-t border-fuchsia-400/15 pt-6 text-xs text-zinc-300">
                      <li className="flex gap-2.5">
                        <span className="text-fuchsia-300">✓</span>
                        <strong>1,000 tickets / month</strong>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-fuchsia-300">✓</span>
                        <strong>Bulk archive imports</strong>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-fuchsia-300">✓</span>Highest
                        priority queue
                      </li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleSelectPlan("creator")}
                      className="mt-8 flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25 transition hover:bg-fuchsia-400"
                    >
                      Go Creator <span className="ml-1">→</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-6">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-500 transition hover:text-white"
                  >
                    <ChevronLeft className="size-4 stroke-[2]" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPlan("free")}
                    className="cursor-pointer text-xs font-semibold text-zinc-500 transition hover:text-white"
                  >
                    Skip for now <span className="ml-1">→</span>
                  </button>
                </div>
              </section>
            )}

            {/* STEP 4: Ready */}
            {step === 4 && (
              <section
                aria-labelledby="complete-step-title"
                className="flex flex-col gap-8"
              >
                <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-emerald-400/20 bg-emerald-400/[0.05] p-7 text-center shadow-2xl shadow-emerald-500/5 sm:p-12">
                  <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-lg shadow-emerald-500/10">
                    <Check className="size-9 stroke-[2]" />
                  </div>
                  <p className="mt-8 text-xs font-bold tracking-[0.2em] text-emerald-300 uppercase">
                    Step 04 · Ready
                  </p>
                  <h2
                    id="complete-step-title"
                    className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl"
                  >
                    You&apos;re all set.
                  </h2>
                  <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-400 sm:text-base">
                    Upload a screenshot of any parlay or single bet slip and
                    we’ll turn it into a live tracker in seconds.
                  </p>

                  <div className="mx-auto mt-8 grid max-w-lg gap-3 text-left sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-lg">✦</p>
                      <p className="mt-3 text-xs font-semibold text-zinc-300">
                        Upload once
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                        Drop in your slip.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-lg">◌</p>
                      <p className="mt-3 text-xs font-semibold text-zinc-300">
                        Track live
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                        Follow every leg.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-lg">✓</p>
                      <p className="mt-3 text-xs font-semibold text-zinc-300">
                        Know sooner
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                        See what hits.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void navigate({ to: "/dashboard" });
                    }}
                    className="mt-9 inline-flex h-12 cursor-pointer items-center justify-center rounded-xl bg-emerald-400 px-7 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300"
                  >
                    <span>Go to dashboard</span>
                    <ChevronRight className="ml-2 size-4 stroke-[2.5]" />
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/onboarding")({
  component: OnboardingWizardComponent,
});
