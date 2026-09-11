import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import {
  CheckCircle2,
  Lock,
  RefreshCw,
  Share2,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api, resolveApiAsset } from "@/lib/api";
import type { PublicProfile } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

const copyProfileLink = () => {
  navigator.clipboard.writeText(window.location.href);
  toast.success("Profile link copied!");
};

const PublicProfileComponent = () => {
  const { username } = useParams({ from: "/u/$username" });

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [session, setSession] = useState<unknown>(null);
  const avatarSource = resolveApiAsset(profile?.avatarUrl ?? profile?.image);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const s = await authClient.getSession();
        if (active) {
          setSession(s.data);
        }
      } catch {
        // session not found
      }

      try {
        const res = await api.community.getPublicProfile(username);
        if (active) {
          setProfile(res.profile);
        }
      } catch {
        // User not found or private
      }

      if (active) {
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [username]);

  const handleToggleFollow = async () => {
    if (!session) {
      toast.info("Sign in to follow bettor scorecards");
      window.location.href = "/login";
      return;
    }

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await api.community.unfollow(username);
        setIsFollowing(false);
        if (profile) {
          const current = profile.followerCount ?? profile.followers ?? 0;
          const updated = Math.max(current - 1, 0);
          setProfile({
            ...profile,
            followerCount: updated,
            followers: updated,
          });
        }
        toast.success(`Unfollowed @${username}`);
      } else {
        await api.community.follow(username);
        setIsFollowing(true);
        if (profile) {
          const current = profile.followerCount ?? profile.followers ?? 0;
          const updated = current + 1;
          setProfile({
            ...profile,
            followerCount: updated,
            followers: updated,
          });
        }
        toast.success(`Following @${username}`);
      }
      setIsFollowLoading(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update follow"
      );
      setIsFollowLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <RefreshCw className="size-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
          <Lock className="size-6 text-zinc-500" />
        </div>
        <h1 className="text-xl font-bold text-white">Profile Not Available</h1>
        <p className="mt-2 text-xs text-zinc-400">
          @{username} either doesn&apos;t exist or has set their betting record
          to private.
        </p>
        <Link
          to="/"
          className="mt-6 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const totalBets = profile.wins + profile.losses;
  const winRate =
    totalBets > 0 ? ((profile.wins / totalBets) * 100).toFixed(1) : "—";

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

          <div className="flex items-center gap-3">
            {session ? (
              <Link
                to="/dashboard"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-700 hover:text-white"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Sign In / Sign Up
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Profile Content */}
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        {/* Profile Header Card */}
        <div className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/20 text-2xl font-black text-emerald-400">
                {avatarSource ? (
                  <img
                    src={avatarSource}
                    alt={profile.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (profile.name || profile.username).slice(0, 2).toUpperCase()
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-white">
                    {profile.name}
                  </h1>
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                    <ShieldCheck className="size-3.5" />
                    Verified Bettor
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-emerald-400">
                  @{profile.username}
                </p>
                {profile.bio && (
                  <p className="mt-2 max-w-lg text-xs text-zinc-300">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* Follow & Share Actions */}
            <div className="flex items-center gap-2.5 self-start sm:self-center">
              <button
                type="button"
                onClick={copyProfileLink}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:text-white"
              >
                <Share2 className="size-3.5" />
                <span className="hidden sm:inline">Share</span>
              </button>

              <button
                type="button"
                onClick={handleToggleFollow}
                disabled={isFollowLoading}
                className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
                  isFollowing
                    ? "border border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-rose-500/40 hover:text-rose-400"
                    : "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="size-3.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3.5" />
                    <span>Follow Scorecard</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Verified Stats Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-bold tracking-wider uppercase">
                Win Rate
              </span>
              <TrendingUp className="size-4 text-emerald-400" />
            </div>
            <p className="mt-2 font-mono text-3xl font-black text-white">
              {winRate}%
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Verified settlement rate
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-bold tracking-wider uppercase">
                Slips Cashed
              </span>
              <CheckCircle2 className="size-4 text-emerald-400" />
            </div>
            <p className="mt-2 font-mono text-3xl font-black text-emerald-400">
              {profile.wins}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">Full parlays won</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-bold tracking-wider uppercase">
                Uncashed
              </span>
              <XCircle className="size-4 text-rose-400" />
            </div>
            <p className="mt-2 font-mono text-3xl font-black text-zinc-300">
              {profile.losses}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">Settled missed</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-bold tracking-wider uppercase">
                Followers
              </span>
              <Users className="size-4 text-zinc-400" />
            </div>
            <p className="mt-2 font-mono text-3xl font-black text-white">
              {profile.followerCount ?? profile.followers ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Tracking this record
            </p>
          </div>
        </div>

        {/* Verification Transparency Explanation */}
        <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="size-5" />
            <h3 className="text-xs font-bold tracking-wider uppercase">
              The ParlayPal Anti-Fraud Guarantee
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-zinc-300">
            All win rates on ParlayPal are computed automatically from uploaded
            slip screenshots verified by Gemini Vision and evaluated by live
            Sportradar game data. Users cannot manually mark a bet as won or
            delete losing slips from their public record.
          </p>
        </div>

        {/* Bottom CTA for Visitors */}
        <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8 text-center">
          <h2 className="text-xl font-bold text-white">
            Track your own bets in real time
          </h2>
          <p className="mx-auto max-w-md text-xs text-zinc-400">
            Join ParlayPal to upload your bet slips from FanDuel, DraftKings,
            and BetMGM and track every leg live as game stats tick.
          </p>
          <Link
            to="/login"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            <span>Create Your Free Account</span>
            <span>→</span>
          </Link>
        </div>
      </main>
    </div>
  );
};

export const Route = createFileRoute("/u/$username")({
  component: PublicProfileComponent,
});
