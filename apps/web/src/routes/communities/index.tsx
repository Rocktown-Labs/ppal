import {
  createFileRoute,
  Link,
  useLoaderData,
  useNavigate,
} from "@tanstack/react-router";
import { Plus, Search, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { absoluteUrl, SITE_NAME, socialMeta } from "@/lib/seo";

type PublicCommunitiesData = Awaited<
  ReturnType<typeof api.community.getPublic>
>;
type BettorsData = Awaited<ReturnType<typeof api.community.getBettors>>;
type JoinedCommunitiesData = Awaited<ReturnType<typeof api.community.getMine>>;

const initialsOf = (name: string): string =>
  name
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "PP";

const priceLabel = (
  community: PublicCommunitiesData["communities"][number]
): string =>
  community.access === "paid" && community.priceCents
    ? `$${(community.priceCents / 100).toFixed(2)} / mo`
    : "Free";

const CommunitiesBrowsePage = () => {
  const initialPublic = useLoaderData({ from: "/communities/" });
  const navigate = useNavigate();
  const [joined, setJoined] = useState<JoinedCommunitiesData["communities"]>(
    []
  );
  const [publicCommunities, setPublicCommunities] = useState(
    initialPublic.communities
  );
  const [bettors, setBettors] = useState<BettorsData["profiles"]>([]);
  const [search, setSearch] = useState("");
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    const loadDirectory = async () => {
      const session = await authClient.getSession().catch(() => null);
      if (active && session?.data) {
        setIsSignedIn(true);
      }
      if (session?.data) {
        try {
          const mine = await api.community.getMine();
          if (active) {
            setJoined(mine.communities);
          }
        } catch {
          // Directory still renders for signed-out visitors.
        }
      }
      try {
        const [discovered, profiles] = await Promise.all([
          api.community.getPublic(50),
          api.community.getBettors(),
        ]);
        if (active) {
          setPublicCommunities(discovered.communities);
          setBettors(profiles.profiles);
        }
      } catch {
        // SSR data is already in place; ignore refresh failures.
      }
    };
    void loadDirectory();
    return () => {
      active = false;
    };
  }, []);

  const joinedSlugs = new Set(joined.map((community) => community.slug));
  const matchesSearch = (
    community: PublicCommunitiesData["communities"][number]
  ) => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return true;
    }
    return (
      community.name.toLowerCase().includes(query) ||
      community.description?.toLowerCase().includes(query) ||
      community.ownerUsername?.toLowerCase().includes(query)
    );
  };

  const joinedRooms = joined.filter((community) => matchesSearch(community));
  const discoverRooms = publicCommunities.filter(
    (community) => matchesSearch(community) && !joinedSlugs.has(community.slug)
  );

  const join = async (slug: string) => {
    const session = await authClient.getSession();
    if (!session.data) {
      await navigate({ to: "/auth/sign-in" });
      return;
    }
    setJoiningSlug(slug);
    try {
      const response = await api.community.join(slug);
      if ("checkoutUrl" in response && response.checkoutUrl) {
        window.location.assign(response.checkoutUrl);
        return;
      }
      toast.success("Joined the community");
      const [mine, discovered] = await Promise.all([
        api.community.getMine(),
        api.community.getPublic(50),
      ]);
      setJoined(mine.communities);
      setPublicCommunities(discovered.communities);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Unable to join community"
      );
    }
    setJoiningSlug(null);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider text-emerald-400 uppercase">
            Bettor hubs & syndicates
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
            Communities
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Join sharp betting rooms, follow verified creator picks, and sweat
            every live leg together.
          </p>
        </div>
        {isSignedIn ? (
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            to="/dashboard/communities"
          >
            <Plus className="size-4" /> New community
          </Link>
        ) : null}
      </header>

      {/* Search */}
      <div className="mt-6 flex items-center rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
        <Search className="size-4 text-zinc-500" />
        <input
          aria-label="Search communities"
          className="ml-2.5 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search communities by name, creator, or description…"
          value={search}
        />
      </div>

      {/* My joined rooms — horizontal scroll */}
      {isSignedIn ? (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
            My joined rooms ({joinedRooms.length})
          </h2>
          {joinedRooms.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">
              You haven’t joined a community yet — discover one below.
            </p>
          ) : (
            <div className="mt-3 flex snap-x gap-4 overflow-x-auto pb-3">
              {joinedRooms.map((community) => (
                <Link
                  className="w-72 shrink-0 snap-start rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-emerald-500/40"
                  key={community.id}
                  params={{ slug: community.slug }}
                  to="/communities/$slug"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 font-mono text-xs font-bold text-emerald-400">
                      {initialsOf(community.name)}
                    </span>
                    <span className="text-[10px] font-medium text-zinc-500">
                      {community.membership.role}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold text-white">
                    {community.name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    by @{community.ownerUsername ?? "founder"} ·{" "}
                    {community.memberCount ?? 0} members
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                    {community.description ?? "A ParlayPal community"}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs">
                    <span className="text-zinc-500">
                      {priceLabel(community)}
                    </span>
                    <span className="font-semibold text-emerald-400">
                      Open →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* Top bettor profiles — horizontal scroll */}
      {bettors.length > 0 ? (
        <section className="mt-8">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
            <Sparkles className="size-3" /> Top bettor profiles (
            {bettors.length})
          </h2>
          <div className="mt-3 flex snap-x gap-4 overflow-x-auto pb-3">
            {bettors.map((bettor) => (
              <Link
                className="w-48 shrink-0 snap-start rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-center transition hover:border-emerald-500/40"
                key={bettor.username}
                params={{ username: bettor.username }}
                to="/u/$username"
              >
                <span className="mx-auto flex size-14 items-center justify-center rounded-full border-2 border-emerald-400 bg-zinc-900 font-mono text-sm font-bold text-emerald-400">
                  {initialsOf(bettor.name)}
                </span>
                <p className="mt-2 truncate text-sm font-semibold text-white">
                  {bettor.name}
                </p>
                <p className="truncate font-mono text-xs text-zinc-500">
                  @{bettor.username}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-400">
                  {bettor.followerCount ?? 0} followers
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Discover communities — grid */}
      <section className="mt-8">
        <h2 className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          Discover communities ({discoverRooms.length})
        </h2>
        {discoverRooms.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
            <Users className="mx-auto mb-3 size-8" />
            <p>No communities found{search ? " matching search" : ""}.</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discoverRooms.map((community) => (
              <div
                className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"
                key={community.id}
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-800 font-mono text-xs font-bold text-zinc-200">
                    {initialsOf(community.name)}
                  </span>
                  <button
                    className="rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/30 disabled:opacity-50"
                    disabled={joiningSlug === community.slug}
                    onClick={() => join(community.slug)}
                    type="button"
                  >
                    {joiningSlug === community.slug ? "Joining…" : "Join"}
                  </button>
                </div>
                <h3 className="mt-3 font-semibold text-white">
                  {community.name}
                </h3>
                <p className="text-xs text-zinc-500">
                  by @{community.ownerUsername ?? "founder"}
                </p>
                <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-zinc-400">
                  {community.description ?? "A ParlayPal community"}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-xs text-zinc-500">
                  <span>{community.memberCount ?? 0} members</span>
                  <span className="font-semibold text-zinc-300">
                    {priceLabel(community)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export const Route = createFileRoute("/communities/")({
  component: CommunitiesBrowsePage,
  loader: async () => {
    try {
      return await api.community.getPublic(50);
    } catch {
      return {
        communities: [] as PublicCommunitiesData["communities"],
      };
    }
  },
  head: () => {
    const title = `Betting Communities | ${SITE_NAME}`;
    const description =
      "Discover sharp betting communities, verified creator picks, and live sweat rooms on ParlayPal.";
    const url = absoluteUrl("/communities");
    return {
      links: [{ href: url, rel: "canonical" }],
      meta: [
        { title },
        { content: description, name: "description" },
        ...socialMeta({ description, title, url }),
      ],
    };
  },
});
