import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { CommunityMembership, CommunitySummary } from "@/lib/api";
import { api } from "@/lib/api";

type OwnedCommunity = CommunitySummary & { membership: CommunityMembership };

const CommunitiesPage = () => {
  const [communities, setCommunities] = useState<OwnedCommunity[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<"free" | "paid">("free");
  const [priceCents, setPriceCents] = useState(1000);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await api.community.getMine();
    setCommunities(response.communities);
  }, []);

  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch {
        // Dashboard auth guard handles the session; an empty list is safe here.
      }
    })();
  }, [load]);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.community.create({
        access,
        description: description.trim() || null,
        name: name.trim(),
        priceCents: access === "paid" ? priceCents : null,
        slug: slug.trim().toLowerCase(),
        visibility: "public",
      });
      toast.success("Community created");
      setShowCreate(false);
      setName("");
      setSlug("");
      setDescription("");
      await load();
      setSaving(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Community could not be created"
      );
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            Creator tools
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">Communities</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Build a private or public home for your picks and members.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
          onClick={() => setShowCreate((value) => !value)}
          type="button"
        >
          <Plus className="size-4" /> New community
        </button>
      </header>
      {showCreate ? (
        <form
          className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:grid-cols-2"
          onSubmit={create}
        >
          <label className="space-y-1 text-sm text-zinc-400">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              minLength={2}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-400">
            URL slug
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              onChange={(event) =>
                setSlug(event.target.value.replaceAll(/[^a-z0-9-]/giu, "-"))
              }
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
              value={slug}
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-400 sm:col-span-2">
            Description
            <textarea
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              value={description}
            />
          </label>
          <label className="space-y-1 text-sm text-zinc-400">
            Access
            <select
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              onChange={(event) =>
                setAccess(event.target.value as "free" | "paid")
              }
              value={access}
            >
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          {access === "paid" ? (
            <label className="space-y-1 text-sm text-zinc-400">
              Price (USD cents)
              <input
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                min={100}
                max={100_000}
                onChange={(event) => setPriceCents(Number(event.target.value))}
                required
                type="number"
                value={priceCents}
              />
            </label>
          ) : null}
          <div className="sm:col-span-2">
            <button
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
              disabled={saving}
              type="submit"
            >
              {saving ? "Creating…" : "Create community"}
            </button>
          </div>
        </form>
      ) : null}
      {communities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
          <Users className="mx-auto mb-3 size-8" />
          <p>You haven’t created or joined a community yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {communities.map((community) => (
            <Link
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-emerald-500/40"
              key={community.id}
              params={{ slug: community.slug }}
              to="/communities/$slug"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">{community.name}</h2>
                <span className="text-xs text-zinc-500">
                  {community.membership.role}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                {community.description ?? "No description"}
              </p>
              <p className="mt-4 text-xs text-emerald-400">
                /{community.slug} →
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/communities")({
  component: CommunitiesPage,
});
