import type {
  TicketContract,
  TicketLegContract,
} from "@ppal/contracts/tickets";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Plus,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { AnalyticsOverview } from "@/lib/api";

const formatWinRate = (rate: number | null | undefined, loading: boolean) => {
  if (loading || rate === null || rate === undefined) {
    return "—";
  }
  const percentage = rate <= 1 ? rate * 100 : rate;
  return `${percentage.toFixed(1)}%`;
};

const getLegStatusColor = (status: string) => {
  if (status === "won") {
    return "text-emerald-400";
  }
  if (status === "lost") {
    return "text-rose-400";
  }
  return "text-zinc-300";
};

const LegRow = ({ leg }: { leg: TicketLegContract }) => {
  const current = leg.currentValue ?? 0;
  const target = leg.targetValue ?? 0;
  const percent =
    target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;

  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/40 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-200">
            {leg.subjectName}
          </p>
          <p className="truncate text-[10px] text-zinc-500">
            {leg.displayDescription || leg.rawDescription}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={`font-mono text-xs font-bold ${getLegStatusColor(leg.status)}`}
          >
            {target > 0 ? `${current} / ${target}` : leg.operator.toUpperCase()}
          </span>
        </div>
      </div>

      {target > 0 && leg.status !== "won" && leg.status !== "lost" && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
};

const TicketCard = ({
  ticket,
  compact = false,
}: {
  compact?: boolean;
  ticket: TicketContract;
}) => {
  const legs = ticket.legs ?? [];
  const wonLegs = legs.filter((l) => l.status === "won").length;
  const lostLegs = legs.filter((l) => l.status === "lost").length;

  const getStatusBadge = () => {
    switch (ticket.status) {
      case "live": {
        return (
          <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            LIVE
          </span>
        );
      }
      case "needs_review": {
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            NEEDS REVIEW
          </span>
        );
      }
      case "won": {
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            WON
          </span>
        );
      }
      case "lost": {
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
            LOST
          </span>
        );
      }
      case "scheduled": {
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
            SCHEDULED
          </span>
        );
      }
      default: {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
            {ticket.status.toUpperCase()}
          </span>
        );
      }
    }
  };

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white transition group-hover:text-emerald-400">
              {ticket.sourceName || "Parlay Slip"}
            </span>
            <span className="font-mono text-[10px] text-zinc-500 uppercase">
              {ticket.ticketType}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            {new Date(ticket.createdAt).toLocaleDateString(undefined, {
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <ChevronRight className="size-4 text-zinc-500 transition group-hover:text-zinc-300" />
        </div>
      </div>

      <div className="mt-3 border-t border-zinc-800/60 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-zinc-400">
            {wonLegs}/{legs.length} Legs Hit
            {lostLegs > 0 ? ` · ${lostLegs} Lost` : ""}
          </span>
          {ticket.verificationStatus === "verified" && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <CheckCircle2 className="size-3" />
              Verified
            </span>
          )}
        </div>

        <div className="mt-2 flex gap-1">
          {legs.map((leg) => {
            let color = "bg-zinc-800";
            if (leg.status === "won") {
              color = "bg-emerald-400";
            } else if (leg.status === "lost") {
              color = "bg-rose-500";
            } else if (leg.status === "live") {
              color = "bg-amber-400 animate-pulse";
            }
            return (
              <div
                key={leg.id}
                className={`h-1.5 flex-1 rounded-full ${color}`}
              />
            );
          })}
        </div>

        {!compact && (
          <div className="mt-3 space-y-2">
            {legs.slice(0, 3).map((leg) => (
              <LegRow key={leg.id} leg={leg} />
            ))}
            {legs.length > 3 && (
              <p className="pt-1 text-center text-[10px] text-zinc-500">
                + {legs.length - 3} more leg{legs.length - 3 > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (ticket.status === "needs_review") {
    return (
      <Link
        to="/dashboard/tickets/$ticketId/review"
        params={{ ticketId: ticket.id }}
        className="group block rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/90"
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <Link
      to="/dashboard/tickets/$ticketId"
      params={{ ticketId: ticket.id }}
      className="group block rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/90"
    >
      {cardContent}
    </Link>
  );
};

const DashboardIndexComponent = () => {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [tickets, setTickets] = useState<TicketContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }
    try {
      const [overviewRes, ticketsRes] = await Promise.all([
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
          .list({ limit: 20 })
          .catch(() => ({ nextCursor: null, tickets: [] })),
      ]);
      setOverview(overviewRes.overview);
      setTickets(ticketsRes.tickets);
      setIsLoading(false);
      setIsRefreshing(false);
    } catch {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchInit = async () => {
      try {
        const [overviewRes, ticketsRes] = await Promise.all([
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
            .list({ limit: 20 })
            .catch(() => ({ nextCursor: null, tickets: [] })),
        ]);
        if (active) {
          setOverview(overviewRes.overview);
          setTickets(ticketsRes.tickets);
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchInit();
    return () => {
      active = false;
    };
  }, []);

  const activeTickets = tickets.filter(
    (t) =>
      t.status === "live" ||
      t.status === "scheduled" ||
      t.status === "needs_review"
  );
  const recentSettledTickets = tickets.filter(
    (t) => t.status === "won" || t.status === "lost" || t.status === "settled"
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
            Live Companion
          </span>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Active Dashboard
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Real-time tracking of every prop, spread, and leg across all
            sportsbooks
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`}
            />
            <span>Refresh</span>
          </button>

          <Link
            to="/dashboard/tickets/upload"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            <Plus className="size-4" />
            <span>Upload Slip</span>
          </Link>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold tracking-wider uppercase">
              In Play
            </span>
            <Flame className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-white sm:text-3xl">
            {isLoading ? "—" : (overview?.active ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Active tickets tracking
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold tracking-wider uppercase">
              Won
            </span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-400 sm:text-3xl">
            {isLoading ? "—" : (overview?.won ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Cashed parlays</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold tracking-wider uppercase">
              Lost
            </span>
            <XCircle className="size-4 text-rose-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-zinc-300 sm:text-3xl">
            {isLoading ? "—" : (overview?.lost ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Settled uncashed</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold tracking-wider uppercase">
              Win Rate
            </span>
            <TrendingUp className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-black text-white sm:text-3xl">
            {formatWinRate(overview?.winRate, isLoading)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-emerald-400">
            {overview?.verified ?? 0} verified slips
          </p>
        </div>
      </div>

      {/* Action Needed Banner */}
      {tickets.some((t) => t.status === "needs_review") && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-xs font-bold text-white">
                Action Required: Ticket Leg Review
              </p>
              <p className="text-[11px] text-amber-300/80">
                You have slips with extracted legs awaiting your verification
                before live tracking starts.
              </p>
            </div>
          </div>
          <Link
            to="/dashboard/tickets"
            className="inline-flex items-center gap-1.5 self-start rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-400"
          >
            <span>Review Slips</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Live & Active Parlays */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-2 animate-pulse rounded-full bg-emerald-400" />
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">
              Live & In-Play Parlays
            </h2>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
              {activeTickets.length}
            </span>
          </div>
          <Link
            to="/dashboard/tickets"
            className="flex items-center gap-1 text-xs font-semibold text-zinc-400 transition hover:text-emerald-400"
          >
            <span>View All Tickets</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {activeTickets.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-12 text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-400">
              <Clock className="size-7 text-zinc-500" />
            </div>
            <h3 className="text-base font-bold text-white">
              No active parlays right now
            </h3>
            <p className="mt-1 max-w-sm text-xs text-zinc-400">
              Upload a screenshot of your ticket from FanDuel, DraftKings, or
              BetMGM to follow each leg live as stats update.
            </p>
            <Link
              to="/dashboard/tickets/upload"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              <Plus className="size-4" />
              <span>Upload Your Slip</span>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Settled History */}
      {recentSettledTickets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-t border-zinc-800/80 pt-6">
            <h2 className="text-sm font-bold tracking-wider text-zinc-400 uppercase">
              Recent Settled Slips
            </h2>
            <Link
              to="/dashboard/tickets"
              className="text-xs font-semibold text-zinc-500 transition hover:text-white"
            >
              Archive →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentSettledTickets.slice(0, 6).map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/")({
  component: DashboardIndexComponent,
});
