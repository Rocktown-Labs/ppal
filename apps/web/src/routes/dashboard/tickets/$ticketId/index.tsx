import type {
  TicketContract,
  TicketLegContract,
} from "@ppal/contracts/tickets";
import {
  Link,
  createFileRoute,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Flame,
  RefreshCw,
  Share2,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { TimelineEvent } from "@/lib/api";

const getDetailedLegStatusBadge = (status: string) => {
  if (status === "won") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
        <CheckCircle2 className="size-3" />
        HIT
      </span>
    );
  }
  if (status === "lost") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-400">
        <XCircle className="size-3" />
        MISSED
      </span>
    );
  }
  if (status === "live") {
    return (
      <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
        <Flame className="size-3 text-amber-400" />
        LIVE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400">
      SCHEDULED
    </span>
  );
};

const getDetailedLegBarColor = (status: string) => {
  if (status === "won") {
    return "bg-emerald-400";
  }
  if (status === "lost") {
    return "bg-rose-500";
  }
  return "bg-emerald-500";
};

const DetailedLegCard = ({ leg }: { leg: TicketLegContract }) => {
  const current = leg.currentValue ?? 0;
  const target = leg.targetValue ?? 0;
  const percent =
    target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  const delta = target > 0 ? Math.max(target - current, 0) : null;

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-800 text-xs font-bold text-zinc-200">
            {leg.subjectName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{leg.subjectName}</h3>
            <p className="text-xs text-zinc-400">
              {leg.displayDescription || leg.rawDescription}
            </p>
          </div>
        </div>

        <div>{getDetailedLegStatusBadge(leg.status)}</div>
      </div>

      {target > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 capitalize">
              {leg.operator} condition
            </span>
            <span className="font-mono font-bold text-white">
              {current} / {target} ({percent}%)
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full transition-all duration-500 ${getDetailedLegBarColor(leg.status)}`}
              style={{ width: `${percent}%` }}
            />
          </div>

          {delta !== null && delta > 0 && leg.status !== "lost" && (
            <p className="font-mono text-[11px] text-zinc-400">
              Needs <strong className="text-emerald-400">{delta}</strong> more
              to hit
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2 text-[11px] text-zinc-500">
        <span className="capitalize">{leg.subjectType} Prop</span>
        <span className="font-mono">
          {leg.settledAt
            ? `Settled ${new Date(leg.settledAt).toLocaleTimeString()}`
            : "Awaiting final settlement"}
        </span>
      </div>
    </div>
  );
};

const copyShareLink = () => {
  navigator.clipboard.writeText(window.location.href);
  toast.success("Link copied to clipboard");
};

const TicketDetailComponent = () => {
  const { ticketId } = useParams({ from: "/dashboard/tickets/$ticketId/" });
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<TicketContract | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "cancel" | "delete" | null
  >(null);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [ticketRes, timelineRes] = await Promise.all([
        api.tickets.get(ticketId),
        api.tickets.timeline(ticketId).catch(() => ({ events: [] })),
      ]);
      setTicket(ticketRes.ticket);
      setTimeline(timelineRes.events);
      setIsRefreshing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load ticket details"
      );
      setIsRefreshing(false);
    }
  };

  const handleCancelTicket = async () => {
    setIsCancelling(true);
    try {
      await api.tickets.cancel(ticketId);
      toast.success("Ticket has been cancelled");
      await handleManualRefresh();
      setIsCancelling(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel ticket"
      );
      setIsCancelling(false);
    }
  };

  const handleDeleteTicket = async () => {
    setIsDeleting(true);
    try {
      await api.tickets.delete(ticketId);
      toast.success("Ticket deleted");
      navigate({ to: "/dashboard/tickets" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete ticket"
      );
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      try {
        const [ticketRes, timelineRes] = await Promise.all([
          api.tickets.get(ticketId),
          api.tickets.timeline(ticketId).catch(() => ({ events: [] })),
        ]);
        if (active) {
          setTicket(ticketRes.ticket);
          setTimeline(timelineRes.events);
          setIsLoading(false);
        }
      } catch (error) {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to load ticket details"
          );
          setIsLoading(false);
        }
      }
    };

    loadInitial();

    const interval = setInterval(async () => {
      try {
        const [ticketRes, timelineRes] = await Promise.all([
          api.tickets.get(ticketId),
          api.tickets.timeline(ticketId).catch(() => ({ events: [] })),
        ]);
        if (active) {
          setTicket(ticketRes.ticket);
          setTimeline(timelineRes.events);
        }
      } catch {
        // background poll ignore
      }
    }, 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [ticketId]);

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
        <AlertTriangle className="mx-auto size-8 text-rose-400" />
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

  const legs = ticket.legs ?? [];
  const wonLegs = legs.filter((l) => l.status === "won").length;
  const lostLegs = legs.filter((l) => l.status === "lost").length;
  const liveLegs = legs.filter((l) => l.status === "live").length;

  const getStatusBadge = () => {
    switch (ticket.status) {
      case "live": {
        return (
          <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-400" />
            LIVE IN-PLAY
          </span>
        );
      }
      case "needs_review": {
        return (
          <Link
            to="/dashboard/tickets/$ticketId/review"
            params={{ ticketId: ticket.id }}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 hover:bg-amber-500/20"
          >
            <AlertTriangle className="size-3.5" />
            NEEDS REVIEW
          </Link>
        );
      }
      case "won": {
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            PARLAY CASHED
          </span>
        );
      }
      case "lost": {
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-400">
            <XCircle className="size-3.5" />
            LOST
          </span>
        );
      }
      case "scheduled": {
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
            <Clock className="size-3.5" />
            SCHEDULED
          </span>
        );
      }
      default: {
        return (
          <span className="inline-flex items-center rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-400 uppercase">
            {ticket.status}
          </span>
        );
      }
    }
  };

  const canCancel = ![
    "won",
    "lost",
    "push",
    "void",
    "partially_void",
    "settled",
  ].includes(ticket.status);
  const canDelete = ["draft", "needs_review", "void"].includes(ticket.status);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/tickets"
            className="flex size-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white sm:text-2xl">
                {ticket.sourceName || "Parlay Slip"}
              </h1>
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-zinc-400 uppercase">
                {ticket.ticketType}
              </span>
              {ticket.verificationStatus === "verified" && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Verified
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              Placed {new Date(ticket.createdAt).toLocaleString()} ·{" "}
              {ticket.ingestionMode} mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex cursor-pointer items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:text-white"
            title="Refresh ticket stats"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {canCancel && (
            <button
              type="button"
              onClick={() => setConfirmAction("cancel")}
              disabled={isCancelling}
              className="flex cursor-pointer items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-50"
              title="Cancel ticket tracking"
            >
              <Ban className="size-3.5" />
              <span className="hidden sm:inline">
                {isCancelling ? "Cancelling..." : "Cancel"}
              </span>
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => setConfirmAction("delete")}
              disabled={isDeleting}
              className="flex cursor-pointer items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-rose-500/40 hover:text-rose-400 disabled:opacity-50"
              title="Delete this ticket"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">
                {isDeleting ? "Deleting..." : "Delete"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={copyShareLink}
            className="flex cursor-pointer items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:text-white"
          >
            <Share2 className="size-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            Legs Won
          </span>
          <p className="mt-2 font-mono text-2xl font-black text-emerald-400 sm:text-3xl">
            {wonLegs}{" "}
            <span className="text-sm font-normal text-zinc-500">
              / {legs.length}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Target reached</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            In Play
          </span>
          <p className="mt-2 font-mono text-2xl font-black text-amber-400 sm:text-3xl">
            {liveLegs}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Live games updating</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            Lost Legs
          </span>
          <p className="mt-2 font-mono text-2xl font-black text-rose-400 sm:text-3xl">
            {lostLegs}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Missed targets</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <span className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
            Slip Status
          </span>
          <p className="mt-2 font-mono text-xl font-black text-white uppercase sm:text-2xl">
            {ticket.status}
          </p>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">
            {ticket.resultSource
              ? ticket.resultSource.replace("_", " ")
              : "Sportradar Feed"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
              Parlay Legs ({legs.length})
            </h2>
            {ticket.status === "needs_review" && (
              <Link
                to="/dashboard/tickets/$ticketId/review"
                params={{ ticketId: ticket.id }}
                className="text-xs font-semibold text-amber-400 hover:underline"
              >
                Edit Extracted Legs →
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {legs.map((leg) => (
              <DetailedLegCard key={leg.id} leg={leg} />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-wider text-zinc-400 uppercase">
              Live Milestone Feed
            </h2>
            <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
          </div>

          <div className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            {timeline.length === 0 ? (
              <div className="space-y-1 py-8 text-center text-xs text-zinc-500">
                <Clock className="mx-auto mb-1 size-5 text-zinc-600" />
                <p>Awaiting game events</p>
                <p className="text-[10px]">
                  Updates stream here automatically as stats change.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {timeline.map((event) => (
                  <div
                    key={event.id}
                    className="relative border-l border-zinc-800 pl-5 text-xs"
                  >
                    <span className="absolute top-1 -left-[5px] size-2 rounded-full bg-emerald-400" />
                    <p className="font-bold text-white">{event.title}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {event.message}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-500">
                      {new Date(event.occurredAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {confirmAction === "cancel"
                ? "Cancel Ticket Tracking?"
                : "Delete Ticket?"}
            </h3>
            <p className="text-xs text-zinc-400">
              {confirmAction === "cancel"
                ? "This will cancel live tracking subscriptions and mark the slip as void."
                : "This ticket will be permanently removed from your vault."}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white"
              >
                Never mind
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === "cancel") {
                    void handleCancelTicket();
                  } else {
                    void handleDeleteTicket();
                  }
                  setConfirmAction(null);
                }}
                className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-bold text-white ${
                  confirmAction === "cancel"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                {confirmAction === "cancel"
                  ? "Confirm Cancel"
                  : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/tickets/$ticketId/")({
  component: TicketDetailComponent,
});
