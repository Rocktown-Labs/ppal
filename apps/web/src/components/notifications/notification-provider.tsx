import { notificationSchema } from "@ppal/contracts/notifications";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { API_BASE_URL, api } from "@/lib/api";
import type { NotificationItem } from "@/lib/api";

interface NotificationContextValue {
  addNotification: (notification: NotificationItem) => void;
  markRead: (notificationId: string) => void;
  notifications: NotificationItem[];
  replaceNotifications: (notifications: NotificationItem[]) => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null
);

const sortByNewest = (
  notifications: Iterable<NotificationItem>
): NotificationItem[] =>
  [...notifications].toSorted(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

const registerServiceWorker = async (): Promise<void> => {
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch {
    // Push is optional; an unavailable service worker must not block the dashboard.
  }
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const seenIds = useRef(new Set<string>());

  const replaceNotifications = useCallback(
    (nextNotifications: NotificationItem[]) => {
      setNotifications((current) => {
        const merged = new Map<string, NotificationItem>();
        for (const notification of current) {
          merged.set(notification.id, notification);
        }
        for (const notification of nextNotifications) {
          const existing = merged.get(notification.id);
          merged.set(notification.id, {
            ...notification,
            readAt: notification.readAt ?? existing?.readAt ?? null,
          });
          seenIds.current.add(notification.id);
        }
        return sortByNewest(merged.values()).slice(0, 100);
      });
    },
    []
  );

  const addNotification = useCallback((notification: NotificationItem) => {
    if (seenIds.current.has(notification.id)) {
      return;
    }
    seenIds.current.add(notification.id);
    setNotifications((current) =>
      sortByNewest([
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ]).slice(0, 100)
    );
    if (notification.type.endsWith(".won")) {
      toast.success(notification.title, { description: notification.body });
    } else if (notification.type.endsWith(".lost")) {
      toast.error(notification.title, { description: notification.body });
    } else {
      toast(notification.title, { description: notification.body });
    }
  }, []);

  const markRead = useCallback((notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              readAt: notification.readAt ?? new Date().toISOString(),
            }
          : notification
      )
    );
  }, []);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await api.notifications.list();
        if (active) {
          replaceNotifications(response.notifications);
        }
      } catch {
        // The dashboard remains usable if the initial feed request fails; SSE can reconnect.
      }
    };
    void loadNotifications();
    return () => {
      active = false;
    };
  }, [replaceNotifications]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }
    if ("serviceWorker" in navigator) {
      void registerServiceWorker();
    }
    if (typeof EventSource === "undefined") {
      return;
    }

    const source = new EventSource(
      `${API_BASE_URL}/api/v1/notifications/stream`,
      { withCredentials: true }
    );
    const handleNotification = (event: Event) => {
      const message = event as MessageEvent<string>;
      try {
        const parsed = notificationSchema.safeParse(JSON.parse(message.data));
        if (parsed.success) {
          addNotification(parsed.data);
        }
      } catch {
        // Ignore malformed events and allow EventSource to continue reconnecting.
      }
    };
    source.addEventListener("notification", handleNotification);
    return () => {
      source.removeEventListener("notification", handleNotification);
      source.close();
    };
  }, [addNotification]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      addNotification,
      markRead,
      notifications,
      replaceNotifications,
      unreadCount: notifications.filter((notification) => !notification.readAt)
        .length,
    }),
    [addNotification, markRead, notifications, replaceNotifications]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationFeed = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationFeed must be used within a NotificationProvider"
    );
  }
  return context;
};
