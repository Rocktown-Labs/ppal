import type { InferResponseType } from "@ppal/api";
import type { WebPushSubscription } from "@ppal/contracts/notifications";
import type { reviewTicketRequestSchema } from "@ppal/contracts/tickets";
import type { CreateUploadRequest } from "@ppal/contracts/uploads";
import type { z } from "zod";

import { API_BASE_URL, client } from "./api-client";

export { API_BASE_URL } from "./api-client";
export type { TicketContract } from "@ppal/contracts/tickets";
export type { UploadContract } from "@ppal/contracts/uploads";
export type { WebPushConfig } from "@ppal/contracts/notifications";

export type ReviewTicketRequest = z.infer<typeof reviewTicketRequestSchema>;

const UPLOAD_URL_PATTERN = /^\/api\/v1\/uploads\/[a-z0-9-]+\/content$/iu;
// ---------------------------------------------------------------------------
// Response and request types are inferred from the server's route chain —
// the hand-written duplicates this file used to carry are gone.
// ---------------------------------------------------------------------------

type CommunityDetail = InferResponseType<
  (typeof client.api.v1.communities)[":slug"]["$get"],
  200
>;
type TicketTimeline = InferResponseType<
  (typeof client.api.v1.tickets)[":ticketId"]["timeline"]["$get"],
  200
>;
type MeResponse = InferResponseType<(typeof client.api.v1.me)["$get"], 200>;
type PublicProfileResponse = InferResponseType<
  (typeof client.api.v1.profiles)[":username"]["$get"],
  200
>;
type AnalyticsOverviewResponse = InferResponseType<
  (typeof client.api.v1.analytics)["overview"]["$get"],
  200
>;
type AnalyticsPlayersResponse = InferResponseType<
  (typeof client.api.v1.analytics)["players"]["$get"],
  200
>;
type NotificationsResponse = InferResponseType<
  (typeof client.api.v1.notifications)["$get"],
  200
>;
type NotificationSettings = InferResponseType<
  (typeof client.api.v1.settings)["notifications"]["$get"],
  200
>;
type EntitlementsResponse = InferResponseType<
  (typeof client.api.v1.billing)["entitlements"]["$get"],
  200
>;
type StripeCatalogResponse = InferResponseType<
  (typeof client.api.v1.admin)["stripe"]["catalog"]["$get"],
  200
>;
type ReferralsResponse = InferResponseType<
  (typeof client.api.v1.referrals)["$get"],
  200
>;
type CatalogSearchResponse = InferResponseType<
  (typeof client.api.v1.catalog)["search"]["$get"],
  200
>;
type JoinedCommunities = InferResponseType<
  (typeof client.api.v1.communities)["$get"],
  200
>;
type CommunityMessages = InferResponseType<
  (typeof client.api.v1.communities)[":slug"]["channels"][":channelId"]["messages"]["$get"],
  200
>;

export type TimelineEvent = TicketTimeline["events"][number];
export type AnalyticsOverview = AnalyticsOverviewResponse["overview"];
export type PlayerSummary = AnalyticsPlayersResponse["players"][number];
export type UserProfile = NonNullable<MeResponse["user"]["profile"]>;
export type CurrentUserWithProfile = MeResponse["user"];
export type PublicProfile = PublicProfileResponse["profile"];
export type NotificationItem = NotificationsResponse["notifications"][number];
export type NotificationPreferences = NotificationSettings["preferences"];
export type CatalogParticipant = CatalogSearchResponse["participants"][number];
export type CatalogMarket = CatalogSearchResponse["markets"][number];
export type CatalogSportsEvent = CatalogSearchResponse["events"][number];
export type BillingEntitlement = EntitlementsResponse["entitlement"];
export type StripeCatalog = StripeCatalogResponse;
export type StripeCatalogPrice = StripeCatalog["plans"][number]["monthly"];
export type ReferralItem = ReferralsResponse["referrals"][number];
export type ReferralSummary = ReferralsResponse["summary"];
export type CommunitySummary = CommunityDetail["community"];
export type CommunityChannel = CommunityDetail["channels"][number];
export type CommunityMembership = NonNullable<CommunityDetail["membership"]>;
export type CommunityMessage = CommunityMessages["messages"][number];
export type CommunityWithMembership = JoinedCommunities["communities"][number];
export interface ManualVerificationRequest {
  legs: {
    id: string;
    status: "won" | "lost" | "push" | "void";
    value: number | null;
  }[];
  source: "settled_slip" | "manual";
}

interface RpcErrorBody {
  code: string;
  error: string;
}

/** Read the shared `{ code, error }` contract out of a failed RPC response. */
const toError = async (res: {
  json: () => Promise<unknown>;
}): Promise<Error> => {
  let message = `API request failed with status ${
    "status" in res ? (res.status as number) : "unknown"
  }`;
  try {
    const body = (await res.json().catch(() => null)) as RpcErrorBody | null;
    if (body && typeof body.error === "string") {
      message = body.error;
    }
  } catch {
    // Non-JSON error body.
  }
  return new Error(message);
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
    getOverview: async () => {
      const res = await client.api.v1.analytics.overview.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getPlayers: async () => {
      const res = await client.api.v1.analytics.players.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },
  },

  billing: {
    getEntitlements: async () => {
      const res = await client.api.v1.billing.entitlements.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getStripeCatalog: async () => {
      const res = await client.api.v1.admin.stripe.catalog.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    syncStripeCatalog: async () => {
      const res = await client.api.v1.admin.stripe.catalog.sync.$post();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },
  },

  catalog: {
    search: async (q: string) => {
      const res = await client.api.v1.catalog.search.$get({ query: { q } });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },
  },

  community: {
    completePaidJoin: async (slug: string, sessionId: string) => {
      const res = await client.api.v1.communities[":slug"]["join"][
        "complete"
      ].$post({
        json: { sessionId },
        param: { slug },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    create: async (payload: {
      access: "free" | "paid";
      description?: string | null;
      name: string;
      priceCents?: number | null;
      rules?: string | null;
      slug: string;
      visibility: "public" | "private";
    }) => {
      const res = await client.api.v1.communities.$post({ json: payload });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    createChannel: async (
      slug: string,
      payload: { description?: string | null; name: string; slug: string }
    ) => {
      const res = await client.api.v1.communities[":slug"].channels.$post({
        json: payload,
        param: { slug },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    follow: async (username: string) => {
      const res = await client.api.v1.profiles[":username"].follow.$post({
        param: { username },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    get: async (slug: string) => {
      const res = await client.api.v1.communities[":slug"].$get({
        param: { slug },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    /** Public bettor directory ordered by follower count. */
    getBettors: async () => {
      const res = await client.api.v1.profiles.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getMe: async () => {
      const res = await client.api.v1.me.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getMembers: async (slug: string) => {
      const res = await client.api.v1.communities[":slug"].members.$get({
        param: { slug },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getMessages: async (
      slug: string,
      channelId: string,
      params?: { cursor?: string; limit?: number }
    ) => {
      const res = await client.api.v1.communities[":slug"].channels[
        ":channelId"
      ].messages.$get({
        param: { channelId, slug },
        query: {
          ...(params?.cursor ? { cursor: params.cursor } : {}),
          ...(params?.limit ? { limit: String(params.limit) } : {}),
        },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getMine: async () => {
      const res = await client.api.v1.communities.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getPublic: async (limit = 50) => {
      const res = await client.api.v1.communities.public.$get({
        query: { limit: String(limit) },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getPublicProfile: async (username: string) => {
      const res = await client.api.v1.profiles[":username"].$get({
        param: { username },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    join: async (slug: string) => {
      const res = await client.api.v1.communities[":slug"].join.$post({
        param: { slug },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    toggleReaction: async (
      slug: string,
      channelId: string,
      messageId: string,
      emoji: string
    ) => {
      const res = await client.api.v1.communities[":slug"].channels[
        ":channelId"
      ].messages[":messageId"].reactions.$post({
        json: { emoji },
        param: { channelId, messageId, slug },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    unfollow: async (username: string) => {
      const res = await client.api.v1.profiles[":username"].follow.$delete({
        param: { username },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    updateMe: async (payload: {
      bio?: string | null;
      isPublic?: boolean;
      name?: string;
      username?: string;
    }) => {
      const res = await client.api.v1.me.$patch({ json: payload });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

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
    getSettings: async () => {
      const res = await client.api.v1.settings.notifications.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getWebPushConfig: async () => {
      const res = await client.api.v1.notifications["web-push"].config.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    list: async () => {
      const res = await client.api.v1.notifications.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    markRead: async (id: string) => {
      const res = await client.api.v1.notifications[
        ":notificationId"
      ].read.$patch({
        param: { notificationId: id },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    removeWebPushSubscription: async (endpoint: string) => {
      const res = await client.api.v1.notifications[
        "web-push"
      ].subscription.$delete({
        json: { endpoint },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    saveWebPushSubscription: async (payload: WebPushSubscription) => {
      const res = await client.api.v1.notifications[
        "web-push"
      ].subscription.$put({
        json: payload,
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    updateSettings: async (payload: NotificationPreferences) => {
      const res = await client.api.v1.settings.notifications.$patch({
        json: payload,
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },
  },

  referrals: {
    claim: async (code: string) => {
      const res = await client.api.v1.referrals[":code"].claim.$post({
        param: { code },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    createCode: async () => {
      const res = await client.api.v1.referrals.$post();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    get: async () => {
      const res = await client.api.v1.referrals.$get();
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    getByCode: async (code: string) => {
      const res = await client.api.v1.referrals[":code"].$get({
        param: { code },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },
  },

  tickets: {
    cancel: async (ticketId: string) => {
      const res = await client.api.v1.tickets[":ticketId"].cancel.$post({
        param: { ticketId },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    confirm: async (ticketId: string) => {
      const res = await client.api.v1.tickets[":ticketId"].confirm.$post({
        param: { ticketId },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    delete: async (ticketId: string) => {
      const res = await client.api.v1.tickets[":ticketId"].$delete({
        param: { ticketId },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return null;
    },

    get: async (ticketId: string) => {
      const res = await client.api.v1.tickets[":ticketId"].$get({
        param: { ticketId },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    list: async (params?: { cursor?: string; limit?: number }) => {
      const res = await client.api.v1.tickets.$get({
        query: {
          ...(params?.cursor ? { cursor: params.cursor } : {}),
          ...(params?.limit ? { limit: String(params.limit) } : {}),
        },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    manualSettlement: async (
      ticketId: string,
      payload: ManualVerificationRequest
    ) => {
      const res = await client.api.v1.tickets[":ticketId"][
        "manual-settlement"
      ].$post({
        json: payload,
        param: { ticketId },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    review: async (ticketId: string, payload: ReviewTicketRequest) => {
      const res = await client.api.v1.tickets[":ticketId"].review.$patch({
        json: payload,
        param: { ticketId },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    timeline: async (ticketId: string) => {
      const res = await client.api.v1.tickets[":ticketId"].timeline.$get({
        param: { ticketId },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },
  },

  uploads: {
    createIntent: async (payload: CreateUploadRequest) => {
      const res = await client.api.v1.uploads.intents.$post({ json: payload });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

    get: async (uploadId: string) => {
      const res = await client.api.v1.uploads[":uploadId"].$get({
        param: { uploadId },
      });
      if (!res.ok) {
        throw await toError(res);
      }
      return res.json();
    },

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
          const res = (await response.json()) as { error?: string };
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
