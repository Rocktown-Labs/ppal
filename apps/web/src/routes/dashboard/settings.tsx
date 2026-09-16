import {
  getCurrentSubscription,
  isPushSupported,
  serializeSubscription,
  subscribe,
  unsubscribe,
} from "@mmmike/web-push/client";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Check,
  Copy,
  CreditCard,
  Gift,
  Mail,
  RefreshCw,
  Save,
  Shield,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Settings } from "@/components/auth/settings/settings";
import { api } from "@/lib/api";
import type { BillingEntitlement, NotificationPreferences } from "@/lib/api";
import { startWebSubscriptionCheckout } from "@/lib/billing";

const getPlanBadgeClass = (plan: string) => {
  if (plan === "pro") {
    return "border border-emerald-500/40 bg-emerald-500/20 text-emerald-400";
  }
  if (plan === "creator") {
    return "border border-purple-500/40 bg-purple-500/20 text-purple-400";
  }
  return "bg-zinc-800 text-zinc-300";
};

const getPlanQuota = (plan: string) => {
  if (plan === "creator") {
    return "1,000 / mo";
  }
  if (plan === "pro") {
    return "500 / mo";
  }
  return "5 / mo";
};

const enableBrowserPush = async (): Promise<void> => {
  const config = await api.notifications.getWebPushConfig();
  if (!config.enabled || !config.publicKey) {
    throw new Error("Browser push notifications are not configured yet");
  }
  if (!isPushSupported()) {
    throw new Error(
      "This browser does not support push notifications. Try Chrome, Edge, Firefox, or an installed iOS web app."
    );
  }
  await navigator.serviceWorker.register("/sw.js");
  const result = await subscribe(config.publicKey);
  if (result.status === "denied") {
    throw new Error(
      "Notifications are blocked. Allow notifications for ParlayPal in your browser settings and try again."
    );
  }
  if (result.status === "unsupported") {
    throw new Error("This browser does not support push notifications");
  }
  await api.notifications.saveWebPushSubscription(
    serializeSubscription(result.subscription)
  );
};

const disableBrowserPush = async (): Promise<void> => {
  const endpoint = await unsubscribe();
  if (endpoint) {
    await api.notifications.removeWebPushSubscription(endpoint);
  }
};

const SettingsComponent = () => {
  const [entitlement, setEntitlement] = useState<BillingEntitlement | null>(
    null
  );
  const [referral, setReferral] = useState<{
    code: string;
    shareUrl: string;
    summary: { completed: number; pending: number; total: number };
  } | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [prefs, setPrefs] = useState({
    emailEnabled: true,
    inAppEnabled: true,
    legLost: true,
    legWon: true,
    pushEnabled: true,
    ticketLost: true,
    ticketWon: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isWebPushEnabled, setIsWebPushEnabled] = useState(false);
  const [isWebPushSaving, setIsWebPushSaving] = useState(false);
  const [webPushAvailable, setWebPushAvailable] = useState(false);
  const [isCheckoutStarting, setIsCheckoutStarting] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchSettings = async () => {
      try {
        const [billingRes, notifRes, referralRes] = await Promise.all([
          api.billing.getEntitlements().catch(() => ({
            entitlement: {
              currentPeriodEnd: null,
              plan: "free" as const,
              source: null,
              status: "active",
            },
          })),
          api.notifications.getSettings().catch(() => ({ preferences: {} })),
          api.referrals.get().catch(() => null),
        ]);
        if (active) {
          setEntitlement(billingRes.entitlement);
          if (referralRes) {
            setReferral({
              code: referralRes.code,
              shareUrl: referralRes.shareUrl,
              summary: referralRes.summary,
            });
          }
          const p = notifRes.preferences as
            | Partial<NotificationPreferences>
            | undefined;
          if (p && Object.keys(p).length > 0) {
            setPrefs({
              emailEnabled: p.emailEnabled ?? true,
              inAppEnabled: p.inAppEnabled ?? true,
              legLost: p.legLost ?? true,
              legWon: p.legWon ?? true,
              pushEnabled: p.pushEnabled ?? true,
              ticketLost: p.ticketLost ?? true,
              ticketWon: p.ticketWon ?? true,
            });
          }
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchWebPushStatus = async () => {
      try {
        const config = await api.notifications.getWebPushConfig();
        if (!active) {
          return;
        }
        setWebPushAvailable(config.enabled && isPushSupported());
        if (config.enabled && isPushSupported()) {
          setIsWebPushEnabled(Boolean(await getCurrentSubscription()));
        }
      } catch {
        if (active) {
          setWebPushAvailable(false);
        }
      }
    };
    void fetchWebPushStatus();
    return () => {
      active = false;
    };
  }, []);

  const handleCopyReferral = () => {
    if (!referral?.shareUrl) {
      return;
    }
    navigator.clipboard.writeText(referral.shareUrl);
    setCopiedReferral(true);
    toast.success("Referral link copied to clipboard");
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      await api.notifications.updateSettings(prefs);
      toast.success("Notification preferences saved");
      setIsSaving(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings"
      );
      setIsSaving(false);
    }
  };

  const handleEnableWebPush = async () => {
    setIsWebPushSaving(true);
    try {
      await enableBrowserPush();
      setIsWebPushEnabled(true);
      setWebPushAvailable(true);
      toast.success("Browser notifications enabled");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not enable browser notifications"
      );
    }
    setIsWebPushSaving(false);
  };

  const handleDisableWebPush = async () => {
    setIsWebPushSaving(true);
    try {
      await disableBrowserPush();
      setIsWebPushEnabled(false);
      toast.success("Browser notifications disabled");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not disable browser notifications"
      );
    }
    setIsWebPushSaving(false);
  };

  const handleUpgrade = async () => {
    setIsCheckoutStarting(true);
    try {
      await startWebSubscriptionCheckout({
        billingPeriod: "monthly",
        cancelPath: "/dashboard/settings",
        plan: "pro",
        successPath: "/dashboard/settings",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Checkout could not be started"
      );
      setIsCheckoutStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  const plan = entitlement?.plan || "free";
  let webPushActionLabel = "Enable";
  if (isWebPushSaving) {
    webPushActionLabel = "Updating...";
  } else if (isWebPushEnabled) {
    webPushActionLabel = "Disable";
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Header */}
      <div>
        <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
          Preferences & Subscription
        </span>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Account Settings
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Tune your live notification triggers, delivery channels, and
          membership subscription
        </p>
      </div>

      {/* Subscription & Entitlements Section */}
      <div className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <CreditCard className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Membership Plan
              </h2>
              <p className="text-xs text-zinc-400">
                Your current slip quota and polling speed
              </p>
            </div>
          </div>

          <span
            className={`rounded-full px-3 py-1 font-mono text-xs font-bold uppercase ${getPlanBadgeClass(plan)}`}
          >
            {plan} Tier
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Monthly Slip Quota
            </span>
            <p className="font-mono text-xl font-bold text-white">
              {getPlanQuota(plan)}
            </p>
          </div>

          <div className="space-y-1 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Update Frequency
            </span>
            <p className="font-mono text-xl font-bold text-white">
              {plan === "free" ? "Standard" : "Fast (5-min)"}
            </p>
          </div>

          <div className="space-y-1 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Account Status
            </span>
            <p className="font-mono text-xl font-bold text-emerald-400 capitalize">
              {entitlement?.status || "Active"}
            </p>
          </div>
        </div>

        {plan === "free" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-5 shrink-0 text-emerald-400" />
              <p className="text-xs text-zinc-300">
                Unlock <strong>500 tickets/month</strong> and fast 5-minute live
                stat updates with ParlayPal Pro.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={isCheckoutStarting}
              className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              {isCheckoutStarting
                ? "Opening checkout…"
                : "Upgrade to Pro ($12.99/mo)"}
            </button>
          </div>
        )}
      </div>

      {/* Notification Preferences Section */}
      <div className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
            <Bell className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Notification Triggers
            </h2>
            <p className="text-xs text-zinc-400">
              Choose which events trigger real-time push and email alerts
            </p>
          </div>
        </div>

        {/* Channels */}
        <div className="space-y-3">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Delivery Channels
          </span>
          <div className="grid gap-3 sm:grid-cols-3">
            <label
              htmlFor="push-alerts"
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5 hover:border-zinc-700"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">
                  Push Alerts
                </span>
              </div>
              <input
                id="push-alerts"
                type="checkbox"
                checked={prefs.pushEnabled}
                onChange={(e) =>
                  setPrefs({ ...prefs, pushEnabled: e.target.checked })
                }
                className="size-4 cursor-pointer accent-emerald-500"
              />
            </label>

            <label
              htmlFor="email-digest"
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5 hover:border-zinc-700"
            >
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">
                  Email Digest
                </span>
              </div>
              <input
                id="email-digest"
                type="checkbox"
                checked={prefs.emailEnabled}
                onChange={(e) =>
                  setPrefs({ ...prefs, emailEnabled: e.target.checked })
                }
                className="size-4 cursor-pointer accent-emerald-500"
              />
            </label>

            <label
              htmlFor="in-app-banner"
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5 hover:border-zinc-700"
            >
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">
                  In-App Banner
                </span>
              </div>
              <input
                id="in-app-banner"
                type="checkbox"
                checked={prefs.inAppEnabled}
                onChange={(e) =>
                  setPrefs({ ...prefs, inAppEnabled: e.target.checked })
                }
                className="size-4 cursor-pointer accent-emerald-500"
              />
            </label>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-white">
                Browser notifications
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Get ticket updates even when ParlayPal is closed.
                {!webPushAvailable &&
                  " Push setup is not available on this browser or environment."}
              </p>
            </div>
            <button
              type="button"
              onClick={
                isWebPushEnabled ? handleDisableWebPush : handleEnableWebPush
              }
              disabled={!webPushAvailable || isWebPushSaving}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {webPushActionLabel}
            </button>
          </div>
        </div>

        {/* Triggers */}
        <div className="space-y-3 border-t border-zinc-800 pt-6">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Game Milestones
          </span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              htmlFor="leg-won"
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5 hover:border-zinc-700"
            >
              <span>
                <span className="block text-xs font-semibold text-white">
                  Leg Hits (Won)
                </span>
                <span className="block text-[10px] text-zinc-500">
                  Alert immediately when an individual prop cashes
                </span>
              </span>
              <input
                id="leg-won"
                aria-label="Alert when a leg hits (won)"
                type="checkbox"
                checked={prefs.legWon}
                onChange={(e) =>
                  setPrefs({ ...prefs, legWon: e.target.checked })
                }
                className="size-4 cursor-pointer accent-emerald-500"
              />
            </label>

            <label
              htmlFor="leg-lost"
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5 hover:border-zinc-700"
            >
              <span>
                <span className="block text-xs font-semibold text-white">
                  Leg Misses (Lost)
                </span>
                <span className="block text-[10px] text-zinc-500">
                  Alert if a prop misses or player is ruled out
                </span>
              </span>
              <input
                id="leg-lost"
                aria-label="Alert when a leg misses (lost)"
                type="checkbox"
                checked={prefs.legLost}
                onChange={(e) =>
                  setPrefs({ ...prefs, legLost: e.target.checked })
                }
                className="size-4 cursor-pointer accent-emerald-500"
              />
            </label>

            <label
              htmlFor="ticket-won"
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5 hover:border-zinc-700"
            >
              <span>
                <span className="block text-xs font-semibold text-white">
                  Full Parlay Cashes (Won)
                </span>
                <span className="block text-[10px] text-zinc-500">
                  Final ticket win celebration notification
                </span>
              </span>
              <input
                id="ticket-won"
                aria-label="Alert when full parlay cashes (won)"
                type="checkbox"
                checked={prefs.ticketWon}
                onChange={(e) =>
                  setPrefs({ ...prefs, ticketWon: e.target.checked })
                }
                className="size-4 cursor-pointer accent-emerald-500"
              />
            </label>

            <label
              htmlFor="ticket-lost"
              className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5 hover:border-zinc-700"
            >
              <span>
                <span className="block text-xs font-semibold text-white">
                  Parlay Settled Lost
                </span>
                <span className="block text-[10px] text-zinc-500">
                  Final uncashed slip settlement update
                </span>
              </span>
              <input
                id="ticket-lost"
                aria-label="Alert when parlay is settled lost"
                type="checkbox"
                checked={prefs.ticketLost}
                onChange={(e) =>
                  setPrefs({ ...prefs, ticketLost: e.target.checked })
                }
                className="size-4 cursor-pointer accent-emerald-500"
              />
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={isSaving}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Save className="size-3.5" />
            <span>{isSaving ? "Saving..." : "Save Preferences"}</span>
          </button>
        </div>
      </div>

      {/* Referral & Invite Section */}
      <div className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <Gift className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Referral Program & Invites
            </h2>
            <p className="text-xs text-zinc-400">
              Invite other bettors to ParlayPal. Qualified referrals unlock Pro
              perks.
            </p>
          </div>
        </div>

        {referral ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  Your Referral Link
                </span>
                <p className="mt-0.5 max-w-md truncate font-mono text-xs text-white">
                  {referral.shareUrl}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-zinc-800 px-2.5 py-1 font-mono text-xs font-bold text-purple-300">
                  {referral.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-600/20 transition hover:bg-purple-500"
                >
                  {copiedReferral ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  <span>{copiedReferral ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5">
                <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  Total Invites
                </span>
                <p className="mt-1 font-mono text-xl font-black text-white">
                  {referral.summary.total}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5">
                <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  Qualified
                </span>
                <p className="mt-1 font-mono text-xl font-black text-emerald-400">
                  {referral.summary.completed}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3.5">
                <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  Pending Slip
                </span>
                <p className="mt-1 font-mono text-xl font-black text-amber-400">
                  {referral.summary.pending}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-center">
            <p className="text-xs text-zinc-400">
              Referral codes are automatically active for all registered
              accounts.
            </p>
          </div>
        )}
      </div>

      {/* Security & Credentials Section (2FA, Passkeys, Linked Accounts, Sessions) */}
      <div className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
            <Shield className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Security & Authentication
            </h2>
            <p className="text-xs text-zinc-400">
              Manage two-factor authentication, passkeys, and connected accounts
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Settings hideNav view="security" />
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsComponent,
});
