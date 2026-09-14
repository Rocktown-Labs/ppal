import type { TicketContract } from "@ppal/contracts/tickets";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Ticket as TicketIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

type FilterTab = "all" | "live" | "scheduled" | "won" | "lost" | "needs_review";

const getTabBadgeClass = (tabId: string) => {
  if (tabId === "live") {
    return "bg-emerald-500/20 text-emerald-400";
  }
  if (tabId === "needs_review") {
    return "bg-amber-500/20 text-amber-400";
  }
  return "bg-zinc-800 text-zinc-400";
};

const getEmptyMessage = (query: string, tab: FilterTab) => {
  if (query) {
    return `No tickets match "${query}". Try clearing your search query.`;
  }
  if (tab === "all") {
    return "Upload a slip image to begin building your verified tracking history.";
  }
  return `You have no tickets currently matching the "${tab}" filter.`;
};

const getLegStatusColor = (status: string) => {
  if (status === "won") {
    return "text-emerald-400";
  }
  if (status === "lost") {
    return "text-rose-400";
  }
  if (status === "live") {
    return "text-amber-400";
  }
  return "text-zinc-500";
};

const formatLegProgress = (current: number | null, target: number | null) => {
  if (current !== null && target !== null) {
    return `${current} / ${target}`;
  }
  return target ?? "—";
};

const TicketsIndexComponent = () => {
  const [tickets, setTickets] = useState<TicketContract[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTickets, setExpandedTickets] = useState<
    Record<string, boolean>
  >({});

  const fetchTickets = async (cursor?: string, append = false) => {
    if (!append) {
      setIsLoading(true);
    }
    try {
      const res = await api.tickets.list({ cursor, limit: 30 });
      setTickets((prev) => (append ? [...prev, ...res.tickets] : res.tickets));
      setNextCursor(res.nextCursor);
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
        const res = await api.tickets.list({ limit: 30 });
        if (active) {
          setTickets(res.tickets);
          setNextCursor(res.nextCursor);
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

  const toggleExpand = (id: string) => {
    setExpandedTickets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredTickets = tickets.filter((t) => {
    if (activeTab === "live" && t.status !== "live") {
      return false;
    }
    if (activeTab === "scheduled" && t.status !== "scheduled") {
      return false;
    }
    if (activeTab === "won" && t.status !== "won") {
      return false;
    }
    if (activeTab === "lost" && t.status !== "lost") {
      return false;
    }
    if (activeTab === "needs_review" && t.status !== "needs_review") {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const sourceMatch = t.sourceName?.toLowerCase().includes(q);
      const legMatch = t.legs?.some(
        (l) =>
          l.subjectName.toLowerCase().includes(q) ||
          l.rawDescription.toLowerCase().includes(q) ||
          l.displayDescription?.toLowerCase().includes(q)
      );
      return sourceMatch || legMatch;
    }
    return true;
  });

  const tabCounts: Record<FilterTab, number> = {
    all: tickets.length,
    live: tickets.filter((t) => t.status === "live").length,
    lost: tickets.filter((t) => t.status === "lost").length,
    needs_review: tickets.filter((t) => t.status === "needs_review").length,
    scheduled: tickets.filter((t) => t.status === "scheduled").length,
    won: tickets.filter((t) => t.status === "won").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
            Bet History & Vault
          </span>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            My Parlay Tickets
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Comprehensive archive of all uploaded slips, live tracking records,
            and settled bets
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setIsRefreshing(true);
              fetchTickets();
            }}
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

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-1">
          {(
            [
              { id: "all", label: "All Slips" },
              { id: "live", label: "Live" },
              { id: "needs_review", label: "Needs Review" },
              { id: "scheduled", label: "Scheduled" },
              { id: "won", label: "Won" },
              { id: "lost", label: "Lost" },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`py-0.2 rounded-full px-1.5 font-mono text-[10px] ${getTabBadgeClass(tab.id)}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by player, team, or sportsbook..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pr-3 pl-9 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Tickets List */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-zinc-800/60 bg-zinc-900/30"
            />
          ))}
        </div>
      )}

      {!isLoading && filteredTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-16 text-center">
          <TicketIcon className="mb-3 size-10 text-zinc-600" />
          <h3 className="text-base font-bold text-white">No tickets found</h3>
          <p className="mt-1 max-w-sm text-xs text-zinc-400">
            {getEmptyMessage(searchQuery, activeTab)}
          </p>
          <Link
            to="/dashboard/tickets/upload"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            <Plus className="size-4" />
            <span>Upload Bet Slip</span>
          </Link>
        </div>
      )}

      {!isLoading && filteredTickets.length > 0 && (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const isExpanded = expandedTickets[ticket.id] ?? false;
            const legs = ticket.legs ?? [];
            const wonLegs = legs.filter((l) => l.status === "won").length;
            const lostLegs = legs.filter((l) => l.status === "lost").length;

            return (
              <div
                key={ticket.id}
                className="overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50 transition hover:border-zinc-700"
              >
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-800/80 font-mono text-xs font-bold text-emerald-400">
                      {ticket.sourceName?.slice(0, 2).toUpperCase() || "SL"}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        {ticket.status === "needs_review" ? (
                          <Link
                            to="/dashboard/tickets/$ticketId/review"
                            params={{ ticketId: ticket.id }}
                            className="text-sm font-bold text-white transition hover:text-emerald-400"
                          >
                            {ticket.sourceName || "Parlay Slip"}
                          </Link>
                        ) : (
                          <Link
                            to="/dashboard/tickets/$ticketId"
                            params={{ ticketId: ticket.id }}
                            className="text-sm font-bold text-white transition hover:text-emerald-400"
                          >
                            {ticket.sourceName || "Parlay Slip"}
                          </Link>
                        )}
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 uppercase">
                          {ticket.ticketType}
                        </span>
                        {ticket.verificationStatus === "verified" && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Verified
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                        <span>
                          {new Date(ticket.createdAt).toLocaleDateString(
                            undefined,
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                        <span>·</span>
                        <span className="font-mono text-zinc-400">
                          {legs.length} Leg{legs.length === 1 ? "" : "s"} (
                          {wonLegs} Won
                          {lostLegs > 0 ? `, ${lostLegs} Lost` : ""})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {ticket.status === "live" && (
                      <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        LIVE
                      </span>
                    )}
                    {ticket.status === "needs_review" && (
                      <Link
                        to="/dashboard/tickets/$ticketId/review"
                        params={{ ticketId: ticket.id }}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-400 transition hover:bg-amber-500/20"
                      >
                        <AlertTriangle className="size-3" />
                        Review Needed
                      </Link>
                    )}
                    {ticket.status === "won" && (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                        WON
                      </span>
                    )}
                    {ticket.status === "lost" && (
                      <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-400">
                        LOST
                      </span>
                    )}
                    {ticket.status === "scheduled" && (
                      <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-400">
                        SCHEDULED
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(ticket.id)}
                      className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                    >
                      <ChevronDown
                        className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>

                    {ticket.status === "needs_review" ? (
                      <Link
                        to="/dashboard/tickets/$ticketId/review"
                        params={{ ticketId: ticket.id }}
                        className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    ) : (
                      <Link
                        to="/dashboard/tickets/$ticketId"
                        params={{ ticketId: ticket.id }}
                        className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
                      >
                        <ChevronRight className="size-4" />
                      </Link>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-2 border-t border-zinc-800/80 bg-zinc-950/40 p-4">
                    <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                      Legs in this parlay
                    </span>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {legs.map((leg) => (
                        <div
                          key={leg.id}
                          className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3 text-xs"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <p className="font-bold text-white">
                                {leg.subjectName}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                {leg.displayDescription || leg.rawDescription}
                              </p>
                            </div>
                            <span
                              className={`font-mono text-[10px] font-bold uppercase ${getLegStatusColor(leg.status)}`}
                            >
                              {leg.status}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between border-t border-zinc-800/40 pt-2 text-[11px]">
                            <span className="text-zinc-500 capitalize">
                              {leg.operator}
                            </span>
                            <span className="font-mono font-semibold text-zinc-300">
                              {formatLegProgress(
                                leg.currentValue,
                                leg.targetValue
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Button */}
      {nextCursor && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => fetchTickets(nextCursor, true)}
            className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-2.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            Load More Tickets
          </button>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/tickets/")({
  component: TicketsIndexComponent,
});
