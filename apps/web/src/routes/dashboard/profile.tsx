import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CheckCircle2,
  Globe,
  Lock,
  RefreshCw,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

const ProfileComponent = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      try {
        const res = await api.community.getMe();
        if (!active) {
          return;
        }
        setEmail(res.user.email);
        setName(res.user.name || "");
        if (res.user.profile) {
          setUsername(res.user.profile.username || "");
          setBio(res.user.profile.bio || "");
          setIsPublic(res.user.profile.isPublic || false);
        }
      } catch {
        // profile might not exist yet
      }

      if (active) {
        setIsLoading(false);
      }
    };

    fetchProfile();

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.community.updateMe({
        bio: bio.trim() || null,
        isPublic,
        name: name.trim(),
        username: username.trim().toLowerCase(),
      });
      toast.success("Profile saved successfully");
      setIsSaving(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
            Account & Identity
          </span>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            My Bettor Profile
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Manage your personal details, public bettor handle, and transparency
            preferences
          </p>
        </div>

        {username && isPublic && (
          <Link
            to="/u/$username"
            params={{ username }}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-emerald-400 transition hover:border-emerald-500/40"
          >
            <span>View Public Profile</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>

      {/* Main Profile Form */}
      <div className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8">
        <div>
          <label
            htmlFor="display-name"
            className="block text-xs font-bold tracking-wider text-zinc-300 uppercase"
          >
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Morgan"
            className="mt-2 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
          />
          {email && (
            <p className="mt-1 font-mono text-[11px] text-zinc-500">
              Signed in as: <span className="text-zinc-400">{email}</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="username-handle"
            className="block text-xs font-bold tracking-wider text-zinc-300 uppercase"
          >
            Username Handle
          </label>
          <div className="mt-2 flex items-center rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 focus-within:border-emerald-400">
            <span className="text-sm text-zinc-500">@</span>
            <input
              id="username-handle"
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/gu, "")
                )
              }
              placeholder="sharp_bettor"
              maxLength={30}
              className="h-11 w-full bg-transparent px-2 text-sm text-white placeholder-zinc-500 outline-none"
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Your public URL will be:{" "}
            <span className="font-mono text-zinc-400">
              /u/{username || "yourhandle"}
            </span>
          </p>
        </div>

        <div>
          <label
            htmlFor="bio-strategy"
            className="block text-xs font-bold tracking-wider text-zinc-300 uppercase"
          >
            Bio / Strategy
          </label>
          <textarea
            id="bio-strategy"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="NBA player prop specialist. Heavy focus on rebounds and assists."
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800/80 p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
          />
        </div>

        <div className="border-t border-zinc-800 pt-6">
          <span className="block text-xs font-bold tracking-wider text-zinc-300 uppercase">
            Public Scorecard Visibility
          </span>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition ${
                isPublic
                  ? "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
                  : "border-emerald-500 bg-emerald-500/10 text-white"
              }`}
            >
              <Lock className="mt-0.5 size-5 shrink-0 text-zinc-400" />
              <div>
                <p className="text-xs font-bold text-white">Private Record</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  Only you can view your tickets and win rate. No public profile
                  is created.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition ${
                isPublic
                  ? "border-emerald-500 bg-emerald-500/10 text-white"
                  : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              <Globe className="mt-0.5 size-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-xs font-bold text-white">Public Scorecard</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  Publish your verified hit rate on{" "}
                  <span className="font-mono">/u/{username || "handle"}</span>.
                  Slip images stay private.
                </p>
              </div>
            </button>
          </div>
        </div>

        <div className="flex justify-end border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Save className="size-3.5" />
            <span>{isSaving ? "Saving..." : "Save Profile"}</span>
          </button>
        </div>
      </div>

      {isPublic && (
        <div className="space-y-4 rounded-3xl border border-zinc-800/80 bg-zinc-900/30 p-6">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Public Card Preview
          </span>
          <div className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-base font-bold text-emerald-400">
              {(name || username || "P").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">
                  {name || "Your Name"}
                </p>
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Verified Bettor
                </span>
              </div>
              <p className="font-mono text-xs text-zinc-400">
                @{username || "yourhandle"}
              </p>
              {bio && <p className="mt-1 text-xs text-zinc-300">{bio}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfileComponent,
});
