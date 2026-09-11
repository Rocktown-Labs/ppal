import type {
  TicketContract,
  TicketLegOperator,
} from "@ppal/contracts/tickets";
import {
  Link,
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  RefreshCw,
  Save,
  Search,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type {
  CatalogMarket,
  CatalogParticipant,
  CatalogSportsEvent,
  ReviewTicketRequest,
} from "@/lib/api";

type EditableLeg = ReviewTicketRequest["legs"][number];

const getResolverBadge = (status: string) => {
  if (status === "resolved") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
        <CheckCircle2 className="size-3.5" />
        Resolved
      </span>
    );
  }
  if (status === "ambiguous") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
        <AlertCircle className="size-3.5" />
        Multiple Matches
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
      <HelpCircle className="size-3.5" />
      Needs Catalog Match
    </span>
  );
};

const TicketReviewComponent = () => {
  const { ticketId } = useParams({
    from: "/dashboard/tickets/$ticketId/review",
  });
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<TicketContract | null>(null);
  const [legs, setLegs] = useState<EditableLeg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Catalog search modal state
  const [searchModalLegIndex, setSearchModalLegIndex] = useState<number | null>(
    null
  );
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<{
    events: CatalogSportsEvent[];
    markets: CatalogMarket[];
    participants: CatalogParticipant[];
  }>({ events: [], markets: [], participants: [] });
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);

  useEffect(() => {
    let active = true;

    const loadTicket = async () => {
      try {
        const res = await api.tickets.get(ticketId);
        if (!active) {
          return;
        }
        setTicket(res.ticket);
        const mappedLegs: EditableLeg[] = res.ticket.legs.map((l) => ({
          displayDescription: l.displayDescription || l.rawDescription,
          id: l.id,
          leagueId: l.leagueId,
          marketId: l.marketId,
          operator: l.operator,
          participantId: l.participantId,
          secondaryTargetValue: l.secondaryTargetValue,
          sportId: l.sportId,
          sportsEventId: l.sportsEventId,
          subjectName: l.subjectName,
          subjectType: l.subjectType,
          targetValue: l.targetValue,
        }));
        setLegs(mappedLegs);
      } catch (error) {
        if (!active) {
          return;
        }
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load ticket for review"
        );
        if (active) {
          setIsLoading(false);
        }
        return;
      }
      if (active) {
        setIsLoading(false);
      }
    };

    loadTicket();

    return () => {
      active = false;
    };
  }, [ticketId]);

  const updateLeg = <K extends keyof EditableLeg>(
    index: number,
    key: K,
    value: EditableLeg[K]
  ) => {
    setLegs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const handleSearchCatalog = async (query: string) => {
    setCatalogQuery(query);
    if (query.trim().length < 2) {
      setCatalogResults({ events: [], markets: [], participants: [] });
      return;
    }
    setIsSearchingCatalog(true);
    try {
      const res = await api.catalog.search(query);
      setCatalogResults(res);
      setIsSearchingCatalog(false);
    } catch {
      setIsSearchingCatalog(false);
    }
  };

  const selectCatalogParticipant = (participant: CatalogParticipant) => {
    if (searchModalLegIndex === null) {
      return;
    }
    updateLeg(searchModalLegIndex, "subjectName", participant.name);
    updateLeg(searchModalLegIndex, "subjectType", participant.type);
    updateLeg(searchModalLegIndex, "participantId", participant.id);
    updateLeg(searchModalLegIndex, "sportId", participant.sportId);
    updateLeg(searchModalLegIndex, "leagueId", participant.leagueId);
    toast.success(`Matched to ${participant.name} (${participant.sportName})`);
  };

  const selectCatalogMarket = (market: CatalogMarket) => {
    if (searchModalLegIndex === null) {
      return;
    }
    updateLeg(searchModalLegIndex, "marketId", market.id);
    if (market.sportId) {
      updateLeg(searchModalLegIndex, "sportId", market.sportId);
    }
    toast.success(`Matched market: ${market.name}`);
  };

  const selectCatalogEvent = (event: CatalogSportsEvent) => {
    if (searchModalLegIndex === null) {
      return;
    }
    updateLeg(searchModalLegIndex, "sportsEventId", event.id);
    toast.success(
      `Matched event: ${event.awayName ?? "TBD"} @ ${event.homeName ?? "TBD"}`
    );
  };

  const handleSaveCorrections = async () => {
    setIsSaving(true);
    try {
      await api.tickets.review(ticketId, { legs });
      toast.success("Ticket legs updated successfully");
      setIsSaving(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save corrections"
      );
      setIsSaving(false);
    }
  };

  const handleConfirmAndStartTracking = async () => {
    setIsConfirming(true);
    try {
      await api.tickets.review(ticketId, { legs });
      await api.tickets.confirm(ticketId);
      toast.success("Slip confirmed! Live tracking is now active.");
      navigate({
        params: { ticketId },
        to: "/dashboard/tickets/$ticketId",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to confirm ticket"
      );
      setIsConfirming(false);
    }
  };

  const renderCatalogList = () => {
    if (isSearchingCatalog) {
      return (
        <p className="py-4 text-center text-xs text-zinc-500">
          Searching catalog...
        </p>
      );
    }
    const resultCount =
      catalogResults.participants.length +
      catalogResults.markets.length +
      catalogResults.events.length;
    if (resultCount === 0) {
      return (
        <p className="py-4 text-center text-xs text-zinc-500">
          {catalogQuery
            ? "No matching athletes or teams found"
            : "Type a name to search"}
        </p>
      );
    }
    return (
      <div className="space-y-4">
        {catalogResults.participants.length > 0 ? (
          <section className="space-y-2">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Players & teams
            </p>
            {catalogResults.participants.map((participant) => (
              <button
                key={participant.id}
                type="button"
                onClick={() => selectCatalogParticipant(participant)}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-zinc-800 bg-zinc-800/50 p-3 text-left transition hover:border-emerald-500/50 hover:bg-emerald-500/10"
              >
                <div>
                  <p className="text-xs font-bold text-white">
                    {participant.name}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {participant.sportName}
                    {participant.leagueName
                      ? ` · ${participant.leagueName}`
                      : ""}
                  </p>
                </div>
                <span className="rounded bg-zinc-700 px-2 py-0.5 font-mono text-[10px] text-zinc-300 capitalize">
                  {participant.type}
                </span>
              </button>
            ))}
          </section>
        ) : null}
        {catalogResults.markets.length > 0 ? (
          <section className="space-y-2">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Markets
            </p>
            {catalogResults.markets.map((market) => (
              <button
                key={market.id}
                type="button"
                onClick={() => selectCatalogMarket(market)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-800/50 p-3 text-left text-xs font-bold text-white hover:border-emerald-500/50"
              >
                {market.name}
              </button>
            ))}
          </section>
        ) : null}
        {catalogResults.events.length > 0 ? (
          <section className="space-y-2">
            <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
              Events
            </p>
            {catalogResults.events.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => selectCatalogEvent(event)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-800/50 p-3 text-left hover:border-emerald-500/50"
              >
                <p className="text-xs font-bold text-white">
                  {event.awayName ?? "TBD"} @ {event.homeName ?? "TBD"}
                </p>
                <p className="text-[10px] text-zinc-400">
                  {event.leagueName ?? "League"} ·{" "}
                  {new Date(event.startsAt).toLocaleString()}
                </p>
              </button>
            ))}
          </section>
        ) : null}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="size-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <AlertCircle className="mx-auto size-8 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Ticket not found</h2>
        <Link
          to="/dashboard/tickets"
          className="inline-block rounded-xl bg-zinc-800 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-700"
        >
          Return to Tickets
        </Link>
      </div>
    );
  }

  const isAlreadyConfirmed =
    ticket.status !== "needs_review" && ticket.status !== "draft";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {isAlreadyConfirmed && (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
            <span className="text-xs font-semibold">
              This ticket is already confirmed and currently in tracking mode (
              {ticket.status}).
            </span>
          </div>
          <Link
            to="/dashboard/tickets/$ticketId"
            params={{ ticketId: ticket.id }}
            className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-emerald-400"
          >
            <span>View Live Slip</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
            Extraction Review
          </span>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Verify Ticket Legs
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Review Gemini AI&apos;s extraction from your slip. Confirm players,
            markets, and targets before live game tracking begins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSaveCorrections}
            disabled={isSaving || isConfirming}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            <Save className="size-3.5" />
            <span>{isSaving ? "Saving..." : "Save Draft"}</span>
          </button>
        </div>
      </div>

      {/* Ticket Meta Summary Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 font-mono text-xs font-bold text-emerald-400">
            {ticket.sourceName?.slice(0, 2).toUpperCase() || "SL"}
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              {ticket.sourceName || "Parlay Slip"}
            </p>
            <p className="font-mono text-[10px] text-zinc-400 uppercase">
              {ticket.ticketType} · {ticket.ingestionMode} mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">
            {legs.length} Total Legs
          </span>
        </div>
      </div>

      {/* Legs List */}
      <div className="space-y-4">
        {legs.map((leg, index) => {
          const originalLeg = ticket.legs.find((l) => l.id === leg.id);
          const resolverStatus = originalLeg?.resolverStatus ?? "resolved";

          return (
            <div
              key={leg.id}
              className="space-y-4 rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-4 transition hover:border-zinc-700 sm:p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-zinc-800 font-mono text-xs font-bold text-zinc-300">
                    {index + 1}
                  </span>
                  {getResolverBadge(resolverStatus)}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchModalLegIndex(index);
                      setCatalogQuery(leg.subjectName);
                      handleSearchCatalog(leg.subjectName);
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-400"
                  >
                    <Search className="size-3" />
                    <span>Search Catalog</span>
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`subject-${leg.id}`}
                    className="block text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                  >
                    Subject Name (Player / Team)
                  </label>
                  <input
                    id={`subject-${leg.id}`}
                    type="text"
                    value={leg.subjectName}
                    onChange={(e) =>
                      updateLeg(index, "subjectName", e.target.value)
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`type-${leg.id}`}
                    className="block text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                  >
                    Type
                  </label>
                  <select
                    id={`type-${leg.id}`}
                    value={leg.subjectType}
                    onChange={(e) =>
                      updateLeg(
                        index,
                        "subjectType",
                        e.target.value as "player" | "team" | "game"
                      )
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 text-xs text-white outline-none focus:border-emerald-400"
                  >
                    <option value="player">Player</option>
                    <option value="team">Team</option>
                    <option value="game">Game</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`operator-${leg.id}`}
                    className="block text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                  >
                    Condition
                  </label>
                  <select
                    id={`operator-${leg.id}`}
                    value={leg.operator}
                    onChange={(e) =>
                      updateLeg(
                        index,
                        "operator",
                        e.target.value as TicketLegOperator
                      )
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 text-xs text-white capitalize outline-none focus:border-emerald-400"
                  >
                    <option value="over">Over</option>
                    <option value="under">Under</option>
                    <option value="gte">At Least (GTE)</option>
                    <option value="lte">At Most (LTE)</option>
                    <option value="moneyline">Moneyline</option>
                    <option value="spread">Spread</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`target-${leg.id}`}
                    className="block text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                  >
                    Target Stat
                  </label>
                  <input
                    id={`target-${leg.id}`}
                    type="number"
                    step="0.5"
                    value={leg.targetValue ?? ""}
                    onChange={(e) =>
                      updateLeg(
                        index,
                        "targetValue",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    placeholder="e.g. 24.5"
                    className="mt-1.5 h-9 w-full rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 font-mono text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor={`desc-${leg.id}`}
                    className="block text-[10px] font-bold tracking-wider text-zinc-400 uppercase"
                  >
                    Display Description
                  </label>
                  <input
                    id={`desc-${leg.id}`}
                    type="text"
                    value={leg.displayDescription}
                    onChange={(e) =>
                      updateLeg(index, "displayDescription", e.target.value)
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Catalog Search Modal */}
      {searchModalLegIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Search Sports Catalog
              </h3>
              <button
                type="button"
                onClick={() => setSearchModalLegIndex(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => handleSearchCatalog(e.target.value)}
                placeholder="Search NBA, NFL players and teams..."
                className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-800 pr-3 pl-9 text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-400"
                autoFocus
              />
            </div>

            <p className="text-[11px] text-zinc-400">
              Match the subject, then search again for its market and event. All
              required fields are saved to this leg.
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {renderCatalogList()}
            </div>
            <button
              type="button"
              onClick={() => setSearchModalLegIndex(null)}
              className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black"
            >
              Done matching leg
            </button>
          </div>
        </div>
      )}

      {/* Confirmation CTA Footer */}
      <div className="flex flex-col gap-4 border-t border-zinc-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/dashboard/tickets"
          className="text-xs font-semibold text-zinc-400 transition hover:text-white"
        >
          ← Cancel & Return
        </Link>

        <button
          type="button"
          onClick={handleConfirmAndStartTracking}
          disabled={isConfirming || legs.length === 0}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-3 text-sm font-bold text-black shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          <Zap className="size-4" />
          <span>
            {isConfirming
              ? "Activating Tracking..."
              : "Confirm & Start Live Tracking"}
          </span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/tickets/$ticketId/review")({
  component: TicketReviewComponent,
});
