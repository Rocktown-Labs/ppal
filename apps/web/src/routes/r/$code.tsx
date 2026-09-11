import {
  Link,
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Gift,
  Loader2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

const ReferralLandingComponent = () => {
  const { code } = useParams({ from: "/r/$code" });
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const normalizedCode = code.trim().toUpperCase();

  useEffect(() => {
    let active = true;

    const processReferral = async () => {
      try {
        const res = await api.referrals.getByCode(normalizedCode);
        if (!active) {
          return;
        }

        if (res.referral.available) {
          setIsValid(true);
          setReferrerName(res.referral.referrerName);
          localStorage.setItem("ppal_referral_code", normalizedCode);

          // Check if user is already signed in
          try {
            const session = await authClient.getSession();
            if (session.data?.user) {
              await api.referrals.claim(normalizedCode);
              localStorage.removeItem("ppal_referral_code");
              toast.success(
                `Referral connected with ${res.referral.referrerName}!`
              );
              void navigate({ to: "/dashboard" });
            }
          } catch {
            // Not signed in, continue to landing
          }
        }
        if (active) {
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setIsValid(false);
          setIsLoading(false);
        }
      }
    };

    void processReferral();

    return () => {
      active = false;
    };
  }, [normalizedCode, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="size-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      {/* Top Navbar */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/images/logo.png"
              alt="ParlayPal"
              className="h-8 w-auto object-contain"
            />
          </Link>

          <Link
            to="/login"
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:text-white"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-24">
        {isValid ? (
          <div className="space-y-8">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-xl shadow-purple-500/10">
              <Gift className="size-8" />
            </div>

            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 font-mono text-xs font-bold text-purple-300">
                <CheckCircle2 className="size-3.5" />
                Referral Code {normalizedCode} Applied
              </span>

              <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                You&apos;re invited to ParlayPal
                {referrerName ? ` by ${referrerName}` : ""}.
              </h1>

              <p className="mx-auto max-w-md text-sm text-zinc-400 sm:text-base">
                Join the verified betting community. Turn parlay screenshots
                into live, automated play-by-play stat trackers in seconds.
              </p>
            </div>

            <div className="mx-auto grid max-w-md gap-3 text-left sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Zap className="size-4" />
                  <span className="text-xs font-bold text-white">
                    Live Prop Tracking
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Real-time Sportradar data updates player props with zero
                  manual refreshing.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <ShieldCheck className="size-4" />
                  <span className="text-xs font-bold text-white">
                    Fraud-Proof Records
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Verifiable public scorecards backed by Gemini Vision OCR slip
                  extractions.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Link
                to="/login"
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 text-sm font-bold text-black shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400"
              >
                <span>Claim Invite & Get Started</span>
                <ArrowRight className="size-4" />
              </Link>
              <p className="text-[11px] text-zinc-500">
                Free account · No credit card required to start tracking slips
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
              <Gift className="size-6 text-zinc-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white sm:text-3xl">
                Referral Code Not Found
              </h1>
              <p className="text-xs text-zinc-400">
                The referral code &ldquo;{normalizedCode}&rdquo; is either
                invalid or has expired. You can still create an account and
                track your slips.
              </p>
            </div>

            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-6 text-xs font-bold text-black transition hover:bg-emerald-400"
            >
              Continue to ParlayPal
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export const Route = createFileRoute("/r/$code")({
  component: ReferralLandingComponent,
});
