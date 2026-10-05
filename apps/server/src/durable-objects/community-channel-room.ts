import { communityChatMessageSchema } from "@ppal/contracts/community";
import { DurableObject } from "cloudflare:workers";

import { escapeHtml } from "../lib/html";
import { publishNotification } from "../services/notifications";
import type { NotificationServiceEnv } from "../services/notifications";

interface RoomAttachment {
  channelId: string;
  communityId: string;
  role: string;
  userId: string;
}

interface PostMessageInput {
  body: string;
  channelId: string;
  clientId?: string;
  communityId: string;
  replyToId?: string | null;
  userId: string;
}

type PostMessageResult =
  | {
      clientId?: string;
      code: string;
      error: string;
      ok: false;
      retryAfterSeconds?: number;
    }
  | { message: OutgoingMessage; ok: true };

interface OutgoingMessage {
  author: { avatarUrl: string | null; name: string; username: string | null };
  body: string;
  clientId?: string;
  createdAt: string;
  deletedAt: string | null;
  editedAt: string | null;
  id: string;
  mentions: string[];
  reactions: { count: number; emoji: string; mine: boolean }[];
  replyToId: string | null;
}

const MAX_FRAME_BYTES = 64 * 1024;

interface CommunityRoomEnv extends NotificationServiceEnv {
  COMMUNITY_CHAT_RATE_LIMIT?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
}

const parseMentions = (body: string): string[] =>
  [
    ...new Set(
      [...body.matchAll(/@(?<username>[a-z0-9_]{3,30})/giu)].map((match) =>
        (match.groups?.username ?? "").toLowerCase()
      )
    ),
  ].slice(0, 10);

const json = (value: unknown): string => JSON.stringify(value);

const sendErrorFrame = (
  webSocket: WebSocket,
  frame: {
    clientId?: string;
    code: string;
    error: string;
    retryAfterSeconds?: number;
  }
): void => webSocket.send(json({ ...frame, type: "error" }));

/**
 * One hibernatable object is allocated per channel. D1 is the source of truth;
 * this object only coordinates connected clients and applies per-user chat
 * rate limits, which keeps hot communities sharded instead of global.
 *
 * Messages enter through two doors that share the same persistence path:
 * the WebSocket handler (web clients) and an internal POST handler used by
 * the REST route (native clients without WebSocket cookie support).
 */
export class CommunityChannelRoom extends DurableObject<CommunityRoomEnv> {
  async fetch(request: Request): Promise<Response> {
    if (
      request.method === "POST" &&
      request.headers.get("x-ppal-internal") === "1"
    ) {
      return await this.handleInternalPost(request);
    }

    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const attachment: RoomAttachment = {
      channelId: request.headers.get("x-ppal-channel-id") ?? "",
      communityId: request.headers.get("x-ppal-community-id") ?? "",
      role: request.headers.get("x-ppal-community-role") ?? "member",
      userId: request.headers.get("x-ppal-user-id") ?? "",
    };
    if (
      !(attachment.channelId && attachment.communityId && attachment.userId)
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    server.send(json({ channelId: attachment.channelId, type: "ready" }));
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Worker-internal event channel used by the REST route: broadcasts a
   * delete, or persists + broadcasts a chat message sent over HTTP.
   */
  private async handleInternalPost(request: Request): Promise<Response> {
    const payload = (await request.json().catch(() => null)) as {
      body?: unknown;
      channelId?: unknown;
      clientId?: unknown;
      communityId?: unknown;
      messageId?: unknown;
      reactions?: unknown;
      replyToId?: unknown;
      type?: unknown;
      userId?: unknown;
    } | null;
    if (payload?.type === "delete" && typeof payload.messageId === "string") {
      this.broadcast({ messageId: payload.messageId, type: "delete" });
      return new Response(null, { status: 204 });
    }
    if (payload?.type === "reaction" && typeof payload.messageId === "string") {
      this.broadcast({
        messageId: payload.messageId,
        reactions: payload.reactions ?? [],
        type: "reaction",
      });
      return new Response(null, { status: 204 });
    }
    if (payload?.type === "message") {
      const parsed = communityChatMessageSchema.safeParse({
        body: payload.body,
        clientId: payload.clientId,
        replyToId: payload.replyToId,
        type: "message",
      });
      const { channelId, communityId, userId } = payload;
      const hasContext =
        typeof userId === "string" &&
        typeof channelId === "string" &&
        typeof communityId === "string";
      if (!parsed.success || !hasContext) {
        return Response.json(
          { code: "INVALID_MESSAGE", error: "Invalid message payload" },
          { status: 400 }
        );
      }
      const result = await this.persistMessage({
        body: parsed.data.body,
        channelId,
        clientId: parsed.data.clientId,
        communityId,
        replyToId: parsed.data.replyToId ?? null,
        userId,
      });
      if (!result.ok) {
        return Response.json(
          {
            code: result.code,
            error: result.error,
            ...(result.retryAfterSeconds
              ? { retryAfterSeconds: result.retryAfterSeconds }
              : {}),
          },
          { status: result.code === "RATE_LIMITED" ? 429 : 403 }
        );
      }
      return Response.json(result.message, { status: 201 });
    }
    return new Response("Bad event", { status: 400 });
  }

  // oxlint-disable-next-line complexity
  async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    if (typeof message !== "string") {
      sendErrorFrame(webSocket, {
        code: "INVALID_MESSAGE",
        error: "Text messages are required",
      });
      return;
    }
    if (new TextEncoder().encode(message).byteLength > MAX_FRAME_BYTES) {
      sendErrorFrame(webSocket, {
        code: "MESSAGE_TOO_LARGE",
        error: "Message is too large",
      });
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch {
      sendErrorFrame(webSocket, {
        code: "INVALID_MESSAGE",
        error: "Malformed JSON",
      });
      return;
    }
    const parsed = communityChatMessageSchema.safeParse(payload);
    if (!parsed.success) {
      const clientId =
        typeof payload === "object" &&
        payload !== null &&
        "clientId" in payload &&
        typeof payload.clientId === "string"
          ? payload.clientId.slice(0, 100)
          : undefined;
      sendErrorFrame(webSocket, {
        clientId,
        code: "INVALID_MESSAGE",
        error: "Message must include a body and client id",
      });
      return;
    }
    const attachment =
      webSocket.deserializeAttachment() as RoomAttachment | null;
    if (!attachment) {
      webSocket.close(1008, "Unauthorized");
      return;
    }
    const result = await this.persistMessage({
      body: parsed.data.body,
      channelId: attachment.channelId,
      clientId: parsed.data.clientId,
      communityId: attachment.communityId,
      replyToId: parsed.data.replyToId ?? null,
      userId: attachment.userId,
    });
    if (!result.ok) {
      sendErrorFrame(webSocket, {
        clientId: parsed.data.clientId,
        code: result.code,
        error: result.error,
        ...(result.retryAfterSeconds
          ? { retryAfterSeconds: result.retryAfterSeconds }
          : {}),
      });
    }
  }

  // oxlint-disable-next-line class-methods-use-this
  webSocketClose(webSocket: WebSocket): void {
    webSocket.close();
  }

  // oxlint-disable-next-line class-methods-use-this
  webSocketError(webSocket: WebSocket): void {
    webSocket.close(1011, "Connection error");
  }

  /**
   * Shared persistence + broadcast for chat messages. Validates membership,
   * applies the per-user rate limit, writes to D1, broadcasts to every
   * connected socket, and fans out mention notifications.
   */
  // oxlint-disable-next-line complexity
  private async persistMessage(
    input: PostMessageInput
  ): Promise<PostMessageResult> {
    const membership = await this.env.DB.prepare(
      "SELECT role, status FROM community_members WHERE community_id = ? AND user_id = ?"
    )
      .bind(input.communityId, input.userId)
      .first<{ role: string; status: string }>();
    if (membership?.status !== "active") {
      return {
        clientId: input.clientId,
        code: "MEMBERSHIP_REQUIRED",
        error: "Join the community to chat",
        ok: false,
      };
    }
    const limiter = this.env.COMMUNITY_CHAT_RATE_LIMIT;
    if (limiter?.limit) {
      const rate = await limiter.limit({
        key: `${input.communityId}:${input.userId}`,
      });
      if (!rate.success) {
        return {
          clientId: input.clientId,
          code: "RATE_LIMITED",
          error: "You are sending messages too quickly",
          ok: false,
          retryAfterSeconds: 60,
        };
      }
    }
    const channel = await this.env.DB.prepare(
      "SELECT 1 AS present FROM community_channels WHERE id = ? AND community_id = ? AND is_archived = 0"
    )
      .bind(input.channelId, input.communityId)
      .first<{ present: number }>();
    if (!channel) {
      return {
        clientId: input.clientId,
        code: "CHANNEL_ARCHIVED",
        error: "This channel is no longer available",
        ok: false,
      };
    }

    const mentions = parseMentions(input.body);
    const mentionedProfiles =
      mentions.length > 0
        ? await this.env.DB.prepare(
            `SELECT user_id, username FROM profiles
             WHERE is_public = 1 AND lower(username) IN (${mentions.map(() => "?").join(",")})`
          )
            .bind(...mentions)
            .all<{ user_id: string; username: string }>()
        : { results: [] as { user_id: string; username: string }[] };
    const resolvedMentions = mentionedProfiles.results.map(
      (profile) => profile.username
    );
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await this.env.DB.prepare(
      `INSERT INTO community_messages
         (author_user_id, body, channel_id, community_id, created_at, id, mentions, reply_to_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        input.userId,
        input.body,
        input.channelId,
        input.communityId,
        createdAt,
        id,
        JSON.stringify(resolvedMentions),
        input.replyToId ?? null
      )
      .run();
    const author = await this.env.DB.prepare(
      "SELECT u.image, u.name, p.username FROM user u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?"
    )
      .bind(input.userId)
      .first<{ image: string | null; name: string; username: string | null }>();
    const outgoing: OutgoingMessage = {
      author: {
        avatarUrl: author?.image ?? null,
        name: author?.name ?? "Member",
        username: author?.username ?? null,
      },
      body: escapeHtml(input.body),
      clientId: input.clientId,
      createdAt: new Date(createdAt).toISOString(),
      deletedAt: null,
      editedAt: null,
      id,
      mentions: resolvedMentions,
      reactions: [],
      replyToId: input.replyToId ?? null,
    };
    this.broadcast({ message: outgoing, type: "message" });
    for (const profile of mentionedProfiles.results) {
      this.ctx.waitUntil(
        publishNotification({
          body: `${escapeHtml(author?.name ?? "Someone")} mentioned you in a community channel.`,
          milestoneKey: `community:${id}:mention:${profile.user_id}`,
          ticketId: null,
          title: "You were mentioned",
          type: "community.mention",
          userId: profile.user_id,
          workerEnv: this.env,
        })
      );
    }
    return { message: outgoing, ok: true };
  }

  private broadcast(payload: unknown): void {
    const message = json(payload);
    for (const webSocket of this.ctx.getWebSockets()) {
      try {
        webSocket.send(message);
      } catch {
        webSocket.close(1011, "Connection unavailable");
      }
    }
  }
}
