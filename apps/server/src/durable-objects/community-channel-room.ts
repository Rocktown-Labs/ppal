import { communityChatMessageSchema } from "@ppal/contracts/community";
import { DurableObject } from "cloudflare:workers";

interface RoomAttachment {
  channelId: string;
  communityId: string;
  role: string;
  userId: string;
}

const MAX_FRAME_BYTES = 64 * 1024;

interface CommunityRoomEnv {
  COMMUNITY_CHAT_RATE_LIMIT?: {
    limit: (input: { key: string }) => Promise<{ success: boolean }>;
  };
  DB: D1Database;
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

/**
 * One hibernatable object is allocated per channel. D1 is the source of truth;
 * this object only coordinates connected clients and applies per-user chat
 * rate limits, which keeps hot communities sharded instead of global.
 */
export class CommunityChannelRoom extends DurableObject<CommunityRoomEnv> {
  async fetch(request: Request): Promise<Response> {
    if (
      request.method === "POST" &&
      request.headers.get("x-ppal-internal") === "1"
    ) {
      const payload = (await request.json().catch(() => null)) as {
        messageId?: unknown;
        type?: unknown;
      } | null;
      if (payload?.type === "delete" && typeof payload.messageId === "string") {
        this.broadcast({ messageId: payload.messageId, type: "delete" });
        return new Response(null, { status: 204 });
      }
      return new Response("Bad event", { status: 400 });
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

  // oxlint-disable-next-line complexity
  async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    if (typeof message !== "string") {
      webSocket.send(
        json({
          code: "INVALID_MESSAGE",
          error: "Text messages are required",
          type: "error",
        })
      );
      return;
    }
    if (new TextEncoder().encode(message).byteLength > MAX_FRAME_BYTES) {
      webSocket.send(
        json({
          code: "MESSAGE_TOO_LARGE",
          error: "Message is too large",
          type: "error",
        })
      );
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch {
      webSocket.send(
        json({
          code: "INVALID_MESSAGE",
          error: "Malformed JSON",
          type: "error",
        })
      );
      return;
    }
    const parsed = communityChatMessageSchema.safeParse(payload);
    if (!parsed.success) {
      webSocket.send(
        json({
          code: "INVALID_MESSAGE",
          error: "Message must include a body and client id",
          type: "error",
        })
      );
      return;
    }
    const attachment =
      webSocket.deserializeAttachment() as RoomAttachment | null;
    if (!attachment) {
      webSocket.close(1008, "Unauthorized");
      return;
    }
    const membership = await this.env.DB.prepare(
      "SELECT role, status FROM community_members WHERE community_id = ? AND user_id = ?"
    )
      .bind(attachment.communityId, attachment.userId)
      .first<{ role: string; status: string }>();
    if (membership?.status !== "active") {
      webSocket.send(
        json({
          code: "MEMBERSHIP_REQUIRED",
          error: "Join the community to chat",
          type: "error",
        })
      );
      return;
    }
    const limiter = this.env.COMMUNITY_CHAT_RATE_LIMIT;
    if (limiter?.limit) {
      const rate = await limiter.limit({
        key: `${attachment.communityId}:${attachment.userId}`,
      });
      if (!rate.success) {
        webSocket.send(
          json({
            code: "RATE_LIMITED",
            error: "You are sending messages too quickly",
            retryAfterSeconds: 60,
            type: "error",
          })
        );
        return;
      }
    }
    const channel = await this.env.DB.prepare(
      "SELECT 1 AS present FROM community_channels WHERE id = ? AND community_id = ? AND is_archived = 0"
    )
      .bind(attachment.channelId, attachment.communityId)
      .first<{ present: number }>();
    if (!channel) {
      webSocket.send(
        json({
          code: "CHANNEL_ARCHIVED",
          error: "This channel is no longer available",
          type: "error",
        })
      );
      return;
    }

    const mentions = parseMentions(parsed.data.body);
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
        attachment.userId,
        parsed.data.body,
        attachment.channelId,
        attachment.communityId,
        createdAt,
        id,
        JSON.stringify(resolvedMentions),
        parsed.data.replyToId ?? null
      )
      .run();
    const author = await this.env.DB.prepare(
      "SELECT u.image, u.name, p.username FROM user u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?"
    )
      .bind(attachment.userId)
      .first<{ image: string | null; name: string; username: string | null }>();
    const outgoing = {
      message: {
        author: {
          avatarUrl: author?.image ?? null,
          name: author?.name ?? "Member",
          username: author?.username ?? null,
        },
        body: parsed.data.body,
        clientId: parsed.data.clientId,
        createdAt: new Date(createdAt).toISOString(),
        deletedAt: null,
        editedAt: null,
        id,
        mentions: resolvedMentions,
        replyToId: parsed.data.replyToId ?? null,
      },
      type: "message",
    };
    this.broadcast(outgoing);
    for (const profile of mentionedProfiles.results) {
      this.ctx.waitUntil(
        (async () => {
          await this.env.DB.prepare(
            `INSERT INTO notifications
               (body, id, in_app_visible, milestone_key, title, type, user_id)
             VALUES (?, ?, 1, ?, 'You were mentioned', 'community.mention', ?)
             ON CONFLICT(milestone_key) DO NOTHING`
          )
            .bind(
              `${author?.name ?? "Someone"} mentioned you in a community channel.`,
              crypto.randomUUID(),
              `community:${id}:mention:${profile.user_id}`,
              profile.user_id
            )
            .run();
        })()
      );
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
