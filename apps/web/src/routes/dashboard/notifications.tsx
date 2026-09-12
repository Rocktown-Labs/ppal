import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Flame,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useNotificationFeed } from "@/components/notifications/notification-provider";
import { api } from "@/lib/api";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "ticket_won":
    case "leg_won": {
      return <CheckCircle2 className="size-4 text-emerald-400" />;
    }
    case "ticket_lost":
    case "leg_lost": {
      return <XCircle className="size-4 text-rose-400" />;
    }
    case "milestone": {
      return <Flame className="size-4 text-amber-400" />;
    }
    default: {
      return <Bell className="size-4 text-zinc-400" />;
    }
  }
};

const NotificationsComponent = () => {
  const { markRead, notifications, replaceNotifications, unreadCount } =
    useNotificationFeed();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }
    try {
      const res = await api.notifications.list();
      replaceNotifications(res.notifications);
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
        const res = await api.notifications.list();
        if (active) {
          replaceNotifications(res.notifications);
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
  }, [replaceNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      markRead(id);
      toast.success("Notification marked as read");
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") {
      return n.readAt === null;
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
            Activity Feed
          </span>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Real-time milestones, leg wins, and parlay settlement updates
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchNotifications(true)}
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            filter === "all"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            filter === "unread"
              ? "bg-zinc-800 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* List */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-zinc-900/40"
            />
          ))}
        </div>
      )}

      {!isLoading && filteredNotifications.length === 0 && (
        <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
          <Bell className="mx-auto mb-2 size-8 text-zinc-600" />
          <h3 className="text-sm font-bold text-white">No notifications</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {filter === "unread"
              ? "You&apos;ve read all your notifications."
              : "When games are live and legs hit, updates appear here."}
          </p>
        </div>
      )}

      {!isLoading && filteredNotifications.length > 0 && (
        <div className="space-y-2.5">
          {filteredNotifications.map((item) => {
            const isRead = item.readAt !== null;

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-3 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                  isRead
                    ? "border-zinc-800/60 bg-zinc-900/30 text-zinc-400"
                    : "border-zinc-700/80 bg-zinc-900/80 text-white shadow-sm"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800/80">
                    {getNotificationIcon(item.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-xs font-bold ${isRead ? "text-zinc-300" : "text-white"}`}
                      >
                        {item.title}
                      </p>
                      {!isRead && (
                        <span className="size-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-400">{item.body}</p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-500">
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(item.id)}
                      className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition hover:text-white"
                    >
                      Mark read
                    </button>
                  )}

                  {item.ticketId && (
                    <Link
                      to="/dashboard/tickets/$ticketId"
                      params={{ ticketId: item.ticketId }}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 transition hover:bg-emerald-500/20"
                    >
                      <span>View Ticket</span>
                      <ChevronRight className="size-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Route = createFileRoute("/dashboard/notifications")({
  component: NotificationsComponent,
});
