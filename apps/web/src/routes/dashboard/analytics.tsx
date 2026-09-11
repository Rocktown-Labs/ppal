import type { TicketContract } from "@ppal/contracts/tickets";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Flame,
  PieChart,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { AnalyticsOverview, PlayerSummary } from "@/lib/api";

const formatWinRate = (rate: number | null | undefined, loading: boolean) => {
  if (loading || rate === null || rate === undefined) {
    return "—";
  }
  const percentage = rate <= 1 ? rate * 100 : rate;
  return `${percentage.toFixed(1)}%`;
};

interface EntityStats {
  lost: number;
  total: number;
  won: number;
}

const computeTicketBreakdowns = (tickets: TicketContract[]) => {
  const sportsbookCounts: Record<string, EntityStats> = {};
  let totalLegsCount = 0;

  for (const t of tickets) {
    const source = t.sourceName || "Unspecified";
    if (!sportsbookCounts[source]) {
      sportsbookCounts[source] = { lost: 0, total: 0, won: 0 };
    }
    sportsbookCounts[source].total += 1;
    if (t.status === "won") {
      sportsbookCounts[source].won += 1;
    }
    if (t.status === "lost") {
      sportsbookCounts[source].lost += 1;
    }

    for (const _leg of t.legs ?? []) {
      totalLegsCount += 1;
    }
  }

  const avgLegsPerParlay =
    tickets.length > 0 ? (totalLegsCount / tickets.length).toFixed(1) : "0.0";

  const settledTickets = tickets
    .filter((t) => t.status === "won" || t.status === "lost")
    .slice(0, 10);

  return { avgLegsPerParlay, settledTickets, sportsbookCounts };
};

const SportsbookCard = ({
  sportsbookCounts,
}: {
  sportsbookCounts: Record<string, EntityStats>;
}) => (
  <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
        Breakdown by Sportsbook
      </h3>
      <PieChart className="size-4 text-zinc-500" />
    </div>

    {Object.keys(sportsbookCounts).length === 0 ? (
      <p className="py-4 text-xs text-zinc-500">
        No sportsbook data recorded yet.
      </p>
    ) : (
      <div className="space-y-3">
        {Object.entries(sportsbookCounts).map(([book, stats]) => {
          const winRate =
            stats.won + stats.lost > 0
              ? Math.round((stats.won / (stats.won + stats.lost)) * 100)
              : 0;

          return (
            <div key={book} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">{book}</span>
                <span className="font-mono text-zinc-400">
                  {stats.won}W / {stats.lost}L ({winRate}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${winRate}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const TopPlayersCard = ({ players }: { players: PlayerSummary[] }) => (
  <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
        Most Bet Athletes & Teams
      </h3>
      <Flame className="size-4 text-emerald-400" />
    </div>

    {players.length === 0 ? (
      <p className="py-4 text-xs text-zinc-500">
        No athlete prop data recorded yet.
      </p>
    ) : (
      <div className="space-y-3">
        {players.slice(0, 5).map((player) => {
          const hitRate =
            player.hitRate <= 1
              ? Math.round(player.hitRate * 100)
              : Math.round(player.hitRate);

          return (
            <div
              key={`${player.name}-${player.sport}`}
              className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3 text-xs"
            >
              <div>
                <p className="font-bold text-white">{player.name}</p>
                <p className="text-[10px] text-zinc-500">
                  {player.selections} total legs tracked · {player.sport}
                </p>
              </div>

              <div className="text-right">
                <span
                  className={`font-mono font-bold ${
                    hitRate >= 50 ? "text-emerald-400" : "text-zinc-300"
                  }`}
                >
                  {hitRate}% Hit Rate
                </span>
                <p className="font-mono text-[10px] text-zinc-500">
                  {player.won} Hit · {player.lost} Missed
                </p>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const AnalyticsHubComponent = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [tickets, setTickets] = useState<TicketContract[]>([]);
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAnalytics = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }
    try {
      const [overviewRes, ticketsRes, playersRes] = await Promise.all([
        api.analytics.getOverview().catch(() => ({
          overview: {
            active: 0,
            lost: 0,
            total: 0,
            verified: 0,
            winRate: null,
            won: 0,
          },
        })),
        api.tickets
          .list({ limit: 100 })
          .catch(() => ({ nextCursor: null, tickets: [] })),
        api.analytics.getPlayers().catch(() => ({ players: [] })),
      ]);
      setOverview(overviewRes.overview);
      setTickets(ticketsRes.tickets);
      setPlayers(playersRes.players);
      setIsLoading(false);
      setIsRefreshing(false);
    } catch {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const runFetch = async () => {
      try {
        const [overviewRes, ticketsRes, playersRes] = await Promise.all([
          api.analytics.getOverview().catch(() => ({
            overview: {
              active: 0,
              lost: 0,
              total: 0,
              verified: 0,
              winRate: null,
              won: 0,
            },
          })),
          api.tickets
            .list({ limit: 100 })
            .catch(() => ({ nextCursor: null, tickets: [] })),
          api.analytics.getPlayers().catch(() => ({ players: [] })),
        ]);
        if (active) {
          setOverview(overviewRes.overview);
          setTickets(ticketsRes.tickets);
          setPlayers(playersRes.players);
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    runFetch();
    return () => {
      active = false;
    };
  }, []);

  const { avgLegsPerParlay, settledTickets, sportsbookCounts } =
    computeTicketBreakdowns(tickets);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
            Personal Intelligence
          </span>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Analytics Hub
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Verified hit rates, sportsbook profitability, and player prop trends
            computed from real slips
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:text-white"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* High-level KPI Scorecard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold tracking-wider uppercase">
              Win Rate
            </span>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-black text-white">
            {formatWinRate(overview?.winRate, isLoading)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {overview?.won ?? 0} wins / {overview?.lost ?? 0} losses
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold tracking-wider uppercase">
              Total Slips
            </span>
            <Activity className="size-4 text-zinc-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-black text-white">
            {isLoading ? "—" : (overview?.total ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {overview?.active ?? 0} active in play
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold tracking-wider uppercase">
              Verified Slips
            </span>
            <ShieldCheck className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-black text-emerald-400">
            {isLoading ? "—" : (overview?.verified ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Confirmed via OCR & feeds
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold tracking-wider uppercase">
              Avg Legs / Slip
            </span>
            <BarChart3 className="size-4 text-zinc-400" />
          </div>
          <p className="mt-2 font-mono text-3xl font-black text-white">
            {avgLegsPerParlay}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Across all tracked parlays
          </p>
        </div>
      </div>

      {/* Recent Form Strip */}
      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
            Recent Form (Last 10 Settled Bets)
          </span>
          <span className="font-mono text-xs text-zinc-500">
            Most recent on right
          </span>
        </div>

        {settledTickets.length === 0 ? (
          <p className="py-2 text-xs text-zinc-500">
            No settled tickets yet. When bets settle, your win/loss streak
            appears here.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            {settledTickets.map((t) => (
              <Link
                key={t.id}
                to="/dashboard/tickets/$ticketId"
                params={{ ticketId: t.id }}
                className={`flex size-9 items-center justify-center rounded-xl font-mono text-xs font-bold transition hover:scale-105 ${
                  t.status === "won"
                    ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                    : "border border-rose-500/30 bg-rose-500/10 text-rose-400"
                }`}
                title={`${t.sourceName || "Parlay"} - ${t.status.toUpperCase()}`}
              >
                {t.status === "won" ? "W" : "L"}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Breakdowns Grid: Sportsbooks & Player Props */}
      <div className="grid gap-6 md:grid-cols-2">
        <SportsbookCard sportsbookCounts={sportsbookCounts} />
        <TopPlayersCard players={players} />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/analytics")({
  component: AnalyticsHubComponent,
});
