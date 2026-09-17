import type {
  WebPushConfig,
  WebPushSubscription,
} from "@ppal/contracts/notifications";
import type {
  TicketContract,
  reviewTicketRequestSchema,
} from "@ppal/contracts/tickets";
import type {
  CreateUploadRequest,
  UploadContract,
} from "@ppal/contracts/uploads";
import { env } from "@ppal/env/web";
import type { z } from "zod";

import { resolveServerUrl } from "./server-url";

export type ReviewTicketRequest = z.infer<typeof reviewTicketRequestSchema>;

export const API_BASE_URL = resolveServerUrl(env.VITE_SERVER_URL);
const pathSegment = (value: string): string => encodeURIComponent(value);
const UPLOAD_URL_PATTERN = /^\/api\/v1\/uploads\/[a-z0-9-]+\/content$/iu;

export interface TimelineEvent {
  id: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  ticketLegId: string | null;
  title: string;
  type: string;
}

export interface AnalyticsOverview {
  active: number;
  lost: number;
  total: number;
  verified: number;
  winRate: number | null;
  won: number;
}

export interface PlayerSummary {
  hitRate: number;
  lost: number;
  name: string;
  participantId: string | null;
  selections: number;
  sport: string;
  won: number;
}

export interface UserProfile {
  bio: string | null;
  isPublic: boolean;
  username: string;
}

export interface CurrentUserWithProfile {
  email: string;
  id: string;
  image?: string | null;
  name: string;
  profile: UserProfile | null;
  role?: string;
}

export interface PublicProfile {
  avatarUrl?: string | null;
  bio: string | null;
  followerCount?: number;
  followers?: number;
  image?: string | null;
  losses: number;
  name: string;
  username: string;
  wins: number;
}

export interface NotificationItem {
  body: string;
  createdAt: string;
  data: Record<string, unknown> | null;
  id: string;
  readAt: string | null;
  ticketId: string | null;
  title: string;
  type: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  legLost: boolean;
  legWon: boolean;
  pushEnabled: boolean;
  ticketLost: boolean;
  ticketWon: boolean;
}

export interface CatalogParticipant {
  id: string;
  leagueId: string | null;
  leagueName: string | null;
  name: string;
  shortName: string | null;
  sportId: string;
  sportName: string;
  type: "player" | "team";
}

export interface CatalogMarket {
  id: string;
  name: string;
  slug: string;
  sportId: string | null;
  subjectType: "player" | "team" | "game";
  valueType: "count" | "points" | "binary";
}

export interface CatalogSportsEvent {
  awayName: string | null;
  homeName: string | null;
  id: string;
  leagueName: string | null;
  providerEventId: string;
  startsAt: string;
  status: string;
}

export interface BillingEntitlement {
  currentPeriodEnd: string | null;
  plan: "free" | "pro" | "creator";
  source: string | null;
  status: string;
}

export interface StripeCatalogPrice {
  amountCents: number | null;
  currency: string | null;
  id: string | null;
  interval: "month" | "year";
  lookupKey: string;
  status: "missing" | "needs_sync" | "ready";
}

export interface StripeCatalogPlan {
  annual: StripeCatalogPrice;
  monthly: StripeCatalogPrice;
  plan: "creator" | "pro";
  product: { id: string; name: string } | null;
  productStatus: "missing" | "needs_sync" | "ready";
}

export interface StripeCatalog {
  plans: StripeCatalogPlan[];
  secretConfigured: boolean;
  webhookConfigured: boolean;
  webhookUrl: string;
}

export interface ReferralItem {
  claimedAt: string | null;
  code: string;
  completedAt: string | null;
  createdAt: string;
  id: string;
  status: "pending" | "completed" | "expired" | "cancelled";
}

export interface ReferralSummary {
  completed: number;
  pending: number;
  total: number;
}

export interface CommunitySummary {
  access: "free" | "paid";
  description: string | null;
  id: string;
  name: string;
  ownerUserId: string;
  priceCents: number | null;
  rules: string | null;
  slug: string;
  visibility: "public" | "private";
}

export interface CommunityChannel {
  description: string | null;
  id: string;
  isDefault: boolean;
  name: string;
  position: number;
  slug: string;
}

export interface CommunityMembership {
  role: "owner" | "moderator" | "member";
  status: "active" | "pending" | "muted" | "banned";
}

export interface CommunityMessage {
  author: { avatarUrl: string | null; name: string; username: string | null };
  body: string;
  clientId?: string;
  createdAt: string;
  deletedAt: string | null;
  editedAt: string | null;
  id: string;
  mentions: string[];
  replyToId: string | null;
}

export interface ManualVerificationRequest {
  legs: {
    id: string;
    status: "won" | "lost" | "push" | "void";
    value: number | null;
  }[];
  source: "settled_slip" | "manual";
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = `API request failed with status ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson && typeof errorJson === "object" && "error" in errorJson) {
        errorMessage = String(errorJson.error);
      }
    } catch {
      // Non-JSON error body
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
};

export const calculateSha256 = async (file: Blob): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = [...new Uint8Array(hashBuffer)];
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

export const resolveApiAsset = (
  path: string | null | undefined
): string | null => {
  if (!path) {
    return null;
  }
  try {
    const url = new URL(path, API_BASE_URL);
    const base = new URL(API_BASE_URL);
    const validPath = /^\/api\/v1\/avatar\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(
      url.pathname
    );
    return url.origin === base.origin && validPath ? url.toString() : null;
  } catch {
    return null;
  }
};

export const resolveAvatarSource = (
  source: string | null | undefined
): string | undefined => {
  const apiAsset = resolveApiAsset(source);
  if (apiAsset) {
    return apiAsset;
  }
  if (!source) {
    return undefined;
  }
  try {
    const url = new URL(source);
    const trustedGoogleImage = url.hostname === "lh3.googleusercontent.com";
    return url.protocol === "https:" && trustedGoogleImage
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
};

export const api = {
  analytics: {
    getOverview: () =>
      request<{ overview: AnalyticsOverview }>("/api/v1/analytics/overview"),
    getPlayers: () =>
      request<{ players: PlayerSummary[] }>("/api/v1/analytics/players"),
  },

  billing: {
    getEntitlements: () =>
      request<{ entitlement: BillingEntitlement }>(
        "/api/v1/billing/entitlements"
      ),
    getStripeCatalog: () =>
      request<StripeCatalog>("/api/v1/admin/stripe/catalog"),
    syncStripeCatalog: () =>
      request<StripeCatalog>("/api/v1/admin/stripe/catalog/sync", {
        method: "POST",
      }),
  },

  catalog: {
    search: (q: string) =>
      request<{
        events: CatalogSportsEvent[];
        markets: CatalogMarket[];
        participants: CatalogParticipant[];
      }>(`/api/v1/catalog/search?q=${encodeURIComponent(q)}`),
  },

  community: {
    completePaidJoin: (slug: string, sessionId: string) =>
      request<{ membership: CommunityMembership }>(
        `/api/v1/communities/${pathSegment(slug)}/join/complete`,
        { body: JSON.stringify({ sessionId }), method: "POST" }
      ),

    create: (payload: {
      access: "free" | "paid";
      description?: string | null;
      name: string;
      priceCents?: number | null;
      rules?: string | null;
      slug: string;
      visibility: "public" | "private";
    }) =>
      request<{
        community: CommunitySummary & { membership: CommunityMembership };
      }>("/api/v1/communities", {
        body: JSON.stringify(payload),
        method: "POST",
      }),

    createChannel: (
      slug: string,
      payload: { description?: string | null; name: string; slug: string }
    ) =>
      request<{ channel: CommunityChannel }>(
        `/api/v1/communities/${pathSegment(slug)}/channels`,
        { body: JSON.stringify(payload), method: "POST" }
      ),

    follow: (username: string) =>
      request<{ following: boolean }>(
        `/api/v1/profiles/${pathSegment(username)}/follow`,
        {
          method: "POST",
        }
      ),

    get: (slug: string) =>
      request<{
        channels: CommunityChannel[];
        community: CommunitySummary;
        membership: CommunityMembership | null;
      }>(`/api/v1/communities/${pathSegment(slug)}`),

    getMe: () => request<{ user: CurrentUserWithProfile }>("/api/v1/me"),

    getMessages: (
      slug: string,
      channelId: string,
      params?: { cursor?: string; limit?: number }
    ) => {
      const search = new URLSearchParams();
      if (params?.cursor) {
        search.set("cursor", params.cursor);
      }
      if (params?.limit) {
        search.set("limit", String(params.limit));
      }
      const query = search.toString();
      return request<{
        messages: CommunityMessage[];
        nextCursor: string | null;
      }>(
        `/api/v1/communities/${pathSegment(slug)}/channels/${pathSegment(channelId)}/messages${query ? `?${query}` : ""}`
      );
    },

    getMine: () =>
      request<{
        communities: (CommunitySummary & { membership: CommunityMembership })[];
      }>("/api/v1/communities"),

    getPublic: (limit = 50) =>
      request<{ communities: CommunitySummary[] }>(
        `/api/v1/communities/public?limit=${limit}`
      ),

    getPublicProfile: (username: string) =>
      request<{ profile: PublicProfile }>(
        `/api/v1/profiles/${pathSegment(username)}`
      ),

    join: (slug: string) =>
      request<{
        checkoutUrl?: string | null;
        membership?: CommunityMembership;
      }>(`/api/v1/communities/${pathSegment(slug)}/join`, { method: "POST" }),

    unfollow: (username: string) =>
      request<{ following: boolean }>(
        `/api/v1/profiles/${pathSegment(username)}/follow`,
        {
          method: "DELETE",
        }
      ),

    updateMe: (payload: {
      bio?: string | null;
      isPublic?: boolean;
      name?: string;
      username?: string;
    }) =>
      request<{ updated: boolean }>("/api/v1/me", {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),

    uploadAvatar: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const url = `${API_BASE_URL}/api/v1/me/avatar`;
      const response = await fetch(url, {
        body: formData,
        credentials: "include",
        method: "POST",
      });
      if (!response.ok) {
        let err = `Avatar upload failed (${response.status})`;
        try {
          const res = (await response.json()) as { error?: string };
          if (res?.error) {
            err = res.error;
          }
        } catch {
          // ignore
        }
        throw new Error(err);
      }
      return (await response.json()) as {
        avatarObjectKey: string;
        url: string;
      };
    },
  },

  notifications: {
    getSettings: () =>
      request<{ preferences: NotificationPreferences }>(
        "/api/v1/settings/notifications"
      ),

    getWebPushConfig: () =>
      request<WebPushConfig>("/api/v1/notifications/web-push/config"),

    list: () =>
      request<{ notifications: NotificationItem[] }>("/api/v1/notifications"),

    markRead: (id: string) =>
      request<{ read: boolean }>(
        `/api/v1/notifications/${pathSegment(id)}/read`,
        {
          method: "PATCH",
        }
      ),

    removeWebPushSubscription: (endpoint: string) =>
      request<{ deleted: boolean }>(
        "/api/v1/notifications/web-push/subscription",
        {
          body: JSON.stringify({ endpoint }),
          method: "DELETE",
        }
      ),

    saveWebPushSubscription: (payload: WebPushSubscription) =>
      request<{ subscribed: boolean }>(
        "/api/v1/notifications/web-push/subscription",
        {
          body: JSON.stringify(payload),
          method: "PUT",
        }
      ),

    updateSettings: (payload: NotificationPreferences) =>
      request<{ preferences: NotificationPreferences }>(
        "/api/v1/settings/notifications",
        {
          body: JSON.stringify(payload),
          method: "PATCH",
        }
      ),
  },

  referrals: {
    claim: (code: string) =>
      request<{ claimed: boolean; referralId: string }>(
        `/api/v1/referrals/${pathSegment(code)}/claim`,
        {
          method: "POST",
        }
      ),

    createCode: () =>
      request<{ code: string; shareUrl: string }>("/api/v1/referrals", {
        method: "POST",
      }),

    get: () =>
      request<{
        code: string;
        referrals: ReferralItem[];
        shareUrl: string;
        summary: ReferralSummary;
      }>("/api/v1/referrals"),

    getByCode: (code: string) =>
      request<{
        referral: {
          available: boolean;
          code: string;
        };
      }>(`/api/v1/referrals/${pathSegment(code)}`),
  },

  tickets: {
    cancel: (ticketId: string) =>
      request<{ ticket: TicketContract }>(
        `/api/v1/tickets/${pathSegment(ticketId)}/cancel`,
        {
          method: "POST",
        }
      ),

    confirm: (ticketId: string) =>
      request<{ ticket: TicketContract }>(
        `/api/v1/tickets/${pathSegment(ticketId)}/confirm`,
        {
          method: "POST",
        }
      ),

    delete: (ticketId: string) =>
      request<null>(`/api/v1/tickets/${pathSegment(ticketId)}`, {
        method: "DELETE",
      }),

    get: (ticketId: string) =>
      request<{ ticket: TicketContract }>(
        `/api/v1/tickets/${pathSegment(ticketId)}`
      ),

    list: (params?: { cursor?: string; limit?: number }) => {
      const search = new URLSearchParams();
      if (params?.cursor) {
        search.set("cursor", params.cursor);
      }
      if (params?.limit) {
        search.set("limit", String(params.limit));
      }
      const qs = search.toString();
      return request<{ nextCursor: string | null; tickets: TicketContract[] }>(
        `/api/v1/tickets${qs ? `?${qs}` : ""}`
      );
    },

    manualSettlement: (ticketId: string, payload: ManualVerificationRequest) =>
      request<{ ticket: TicketContract }>(
        `/api/v1/tickets/${pathSegment(ticketId)}/manual-settlement`,
        {
          body: JSON.stringify(payload),
          method: "POST",
        }
      ),

    review: (ticketId: string, payload: ReviewTicketRequest) =>
      request<{ ticket: TicketContract }>(
        `/api/v1/tickets/${pathSegment(ticketId)}/review`,
        {
          body: JSON.stringify(payload),
          method: "PATCH",
        }
      ),

    timeline: (ticketId: string) =>
      request<{ events: TimelineEvent[] }>(
        `/api/v1/tickets/${pathSegment(ticketId)}/timeline`
      ),
  },

  uploads: {
    createIntent: (payload: CreateUploadRequest) =>
      request<{ upload: UploadContract; uploadUrl: string }>(
        "/api/v1/uploads/intents",
        {
          body: JSON.stringify(payload),
          method: "POST",
        }
      ),

    get: (uploadId: string) =>
      request<{ upload: UploadContract }>(
        `/api/v1/uploads/${pathSegment(uploadId)}`
      ),

    uploadContent: async (uploadUrl: string, file: Blob) => {
      if (!UPLOAD_URL_PATTERN.test(uploadUrl)) {
        throw new Error("The API returned an invalid upload destination");
      }
      const url = `${API_BASE_URL}${uploadUrl}`;
      const response = await fetch(url, {
        body: file,
        credentials: "include",
        headers: {
          "Content-Type": file.type,
        },
        method: "PUT",
      });
      if (!response.ok) {
        let err = `Upload failed with status ${response.status}`;
        try {
          const res = await response.json();
          if (res?.error) {
            err = res.error;
          }
        } catch {
          // ignore
        }
        throw new Error(err);
      }
      return (await response.json()) as { accepted: boolean; uploadId: string };
    },
  },
};
