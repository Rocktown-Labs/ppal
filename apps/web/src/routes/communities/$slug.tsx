import { DbProvider, useLiveQuery } from "@tanstack/react-db";
import {
  createFileRoute,
  Link,
  useLoaderData,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { Lock, CornerUpLeft, MessageCircle, Send, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { API_BASE_URL, api } from "@/lib/api";
import type { CommunityChannel, CommunityMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  communityDbClient,
  communityMessageCollection,
  removeCommunityMessage,
  updateCommunityMessageReactions,
  upsertCommunityMessage,
} from "@/lib/community-db";
import { absoluteUrl, noIndexMeta, SITE_NAME, socialMeta } from "@/lib/seo";

type CommunityPageData = Awaited<ReturnType<typeof api.community.get>>;

type CommunityMembersData = Awaited<
  ReturnType<typeof api.community.getMembers>
>;

const QUICK_REACTION_EMOJIS = ["👍", "🔥", "😂", "🎯", "💰", "👀"];

/**
 * Messages broadcast over the WebSocket carry the sender's `clientId` so
 * optimistic rows can be reconciled; the REST history rows do not.
 */
type LiveMessage = CommunityMessage & { clientId?: string };

const CHAT_RECONNECT_BASE_MS = 1000;
const CHAT_RECONNECT_MAX_MS = 10_000;

const reconnectDelayMs = (attempt: number): number =>
  Math.min(CHAT_RECONNECT_BASE_MS * 2 ** attempt, CHAT_RECONNECT_MAX_MS);

const loadPublicCommunity = async (
  slug: string
): Promise<CommunityPageData | null> => {
  try {
    const response = await api.community.get(slug);
    return response;
  } catch {
    // Unknown or private community: fall through to the page-level loader.
    return null;
  }
};

const messageToRow = (channelId: string, message: LiveMessage) => ({
  ...message,
  channelId,
});

const ChannelMessages = ({
  channel,
  communitySlug,
  canChat,
}: {
  canChat: boolean;
  channel: CommunityChannel;
  communitySlug: string;
}) => {
  const [body, setBody] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<LiveMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(
    null
  );
  const socketRef = useRef<WebSocket | null>(null);
  const { data = [] } = useLiveQuery(communityMessageCollection);
  const messages = useMemo(
    () =>
      data
        .filter((message) => message.channelId === channel.id)
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [channel.id, data]
  );

  // Slack-style threading: roots render in the feed, replies nest under the
  // message they answer (replyToId), mirroring the mobile app's chat. A reply
  // whose parent falls outside the loaded page (cursor windows) renders as
  // a root instead of silently disappearing.
  const loadedIds = useMemo(
    () => new Set(messages.map((message) => message.id)),
    [messages]
  );
  const roots = useMemo(
    () =>
      messages.filter(
        (message) => !message.replyToId || !loadedIds.has(message.replyToId)
      ),
    [messages, loadedIds]
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, LiveMessage[]>();
    for (const message of messages) {
      if (!message.replyToId) {
        continue;
      }
      map.set(message.replyToId, [
        ...(map.get(message.replyToId) ?? []),
        message,
      ]);
    }
    return map;
  }, [messages]);

  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      try {
        const response = await api.community.getMessages(
          communitySlug,
          channel.id,
          { limit: 100 }
        );
        if (!active) {
          return;
        }
        for (const message of response.messages) {
          upsertCommunityMessage(messageToRow(channel.id, message));
        }
        setNextCursor(response.nextCursor);
      } catch {
        // Public history can be unavailable for a private channel.
      }
    };
    void loadMessages();
    return () => {
      active = false;
    };
  }, [channel.id, communitySlug]);

  const loadOlderMessages = async (): Promise<void> => {
    if (!(nextCursor && !loadingOlder)) {
      return;
    }
    setLoadingOlder(true);
    setChatError(null);
    try {
      const response = await api.community.getMessages(
        communitySlug,
        channel.id,
        { cursor: nextCursor, limit: 100 }
      );
      for (const message of response.messages) {
        upsertCommunityMessage(messageToRow(channel.id, message));
      }
      setNextCursor(response.nextCursor);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Could not load older messages"
      );
    }
    setLoadingOlder(false);
  };

  useEffect(() => {
    if (!canChat) {
      return;
    }
    let active = true;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;

    const connect = (): void => {
      const socketUrl = new URL(
        `/api/v1/communities/${encodeURIComponent(communitySlug)}/channels/${encodeURIComponent(channel.id)}/ws`,
        API_BASE_URL
      );
      socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        setChatError(null);
        setConnected(true);
      });
      socket.addEventListener("close", (event) => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        setConnected(false);
        if (!active) {
          return;
        }
        if (event.code === 1008) {
          setChatError(event.reason || "Chat access is no longer available");
          return;
        }
        const delay = reconnectDelayMs(reconnectAttempt);
        reconnectAttempt += 1;
        setChatError("Connection interrupted. Reconnecting…");
        reconnectTimer = window.setTimeout(connect, delay);
      });
      socket.addEventListener("error", () => {
        setConnected(false);
        socket.close();
      });
      socket.addEventListener("message", (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as {
            clientId?: string;
            error?: string;
            message?: LiveMessage;
            messageId?: string;
            reactions?: CommunityMessage["reactions"];
            type?: string;
          };
          if (payload.type === "error") {
            if (payload.clientId) {
              removeCommunityMessage(payload.clientId);
            }
            setChatError(payload.error ?? "Message could not be sent");
            return;
          }
          if (payload.type === "delete" && payload.messageId) {
            removeCommunityMessage(payload.messageId);
          }
          if (
            payload.type === "reaction" &&
            payload.messageId &&
            payload.reactions
          ) {
            // Broadcasts carry neutral counts; keep this viewer's own flags.
            const existing = communityMessageCollection.get(payload.messageId);
            const mineEmojis = new Set(
              (existing?.reactions ?? [])
                .filter((reaction) => reaction.mine)
                .map((reaction) => reaction.emoji)
            );
            updateCommunityMessageReactions(
              payload.messageId,
              payload.reactions.map((reaction) => ({
                count: reaction.count,
                emoji: reaction.emoji,
                mine: mineEmojis.has(reaction.emoji),
              }))
            );
          }
          if (payload.type === "message" && payload.message) {
            if (payload.message.clientId) {
              removeCommunityMessage(payload.message.clientId);
            }
            upsertCommunityMessage(messageToRow(channel.id, payload.message));
          }
        } catch {
          // Ignore malformed frames from a disconnected peer.
        }
      });
    };
    connect();

    return () => {
      active = false;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      socketRef.current?.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [canChat, channel.id, communitySlug]);

  const sendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!(trimmed && socketRef.current?.readyState === WebSocket.OPEN)) {
      return;
    }
    const clientId = crypto.randomUUID();
    const optimistic: LiveMessage = {
      author: { avatarUrl: null, name: "You", username: null },
      body: trimmed,
      clientId,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      editedAt: null,
      id: clientId,
      mentions: [],
      reactions: [],
      replyToId: replyTo?.id ?? null,
    };
    upsertCommunityMessage(messageToRow(channel.id, optimistic));
    setChatError(null);
    socketRef.current.send(
      JSON.stringify({
        body: trimmed,
        clientId,
        replyToId: replyTo?.id ?? null,
        type: "message",
      })
    );
    setBody("");
    setReplyTo(null);
  };

  /** Toggle an emoji reaction; the server response is authoritative. */
  const toggleReaction = async (messageId: string, emoji: string) => {
    setChatError(null);
    try {
      const response = await api.community.toggleReaction(
        communitySlug,
        channel.id,
        messageId,
        emoji
      );
      updateCommunityMessageReactions(messageId, response.reactions);
      setReactionPickerFor(null);
    } catch (error: unknown) {
      setChatError(
        error instanceof Error ? error.message : "Reaction could not be saved"
      );
    }
  };

  return (
    <section className="flex min-h-[32rem] flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50">
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <div>
          <h2 className="font-semibold text-white"># {channel.name}</h2>
          <p className="text-xs text-zinc-500">
            {channel.description ?? "Community discussion"}
          </p>
        </div>
        {canChat ? (
          <span
            className={`text-xs ${connected ? "text-emerald-400" : "text-zinc-500"}`}
          >
            {connected ? "Live" : "Connecting…"}
          </span>
        ) : null}
      </header>
      {chatError ? (
        <p
          className="border-b border-amber-400/20 bg-amber-400/5 px-5 py-2 text-xs text-amber-300"
          role="alert"
        >
          {chatError}
        </p>
      ) : null}
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {nextCursor ? (
          <div className="text-center">
            <button
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:text-zinc-600"
              disabled={loadingOlder}
              onClick={loadOlderMessages}
              type="button"
            >
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-zinc-500">
            <MessageCircle className="mb-2 size-8" />
            <p>No messages yet.</p>
            {canChat ? (
              <p className="text-xs">Start the conversation.</p>
            ) : null}
          </div>
        ) : (
          roots.map((message) => {
            const replies = repliesByParent.get(message.id) ?? [];
            let reactionControl: ReactNode = null;
            if (canChat) {
              reactionControl =
                reactionPickerFor === message.id ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-zinc-700 bg-zinc-950 px-1 py-0.5">
                    {QUICK_REACTION_EMOJIS.map((emoji) => (
                      <button
                        aria-label={`React ${emoji}`}
                        className="rounded px-1 text-sm transition hover:bg-zinc-800"
                        key={emoji}
                        onClick={() => toggleReaction(message.id, emoji)}
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      aria-label="Close reaction picker"
                      className="px-1 text-xs text-zinc-500 transition hover:text-zinc-300"
                      onClick={() => setReactionPickerFor(null)}
                      type="button"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <button
                    aria-label="Add reaction"
                    className="inline-flex items-center rounded-full border border-dashed border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-300"
                    onClick={() => setReactionPickerFor(message.id)}
                    type="button"
                  >
                    ＋
                  </button>
                );
            }
            return (
              <article
                key={message.id}
                className="rounded-xl bg-zinc-950/70 px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-zinc-200">
                    {message.author.username
                      ? `@${message.author.username}`
                      : message.author.name}
                  </span>
                  <time className="text-[11px] text-zinc-600">
                    {new Date(message.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap text-zinc-300">
                  {message.body}
                </p>
                {canChat || message.reactions.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {message.reactions.map((reaction) => (
                      <button
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                          reaction.mine
                            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                            : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500"
                        }`}
                        key={reaction.emoji}
                        onClick={() =>
                          toggleReaction(message.id, reaction.emoji)
                        }
                        type="button"
                      >
                        {reaction.emoji}
                        <span className="font-mono text-[10px]">
                          {reaction.count}
                        </span>
                      </button>
                    ))}
                    {reactionControl}
                  </div>
                ) : null}
                {replies.length > 0 ? (
                  <div className="mt-2 space-y-2 border-l-2 border-zinc-800 pl-3">
                    {replies.map((reply) => (
                      <div key={reply.id}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-xs font-semibold text-zinc-400">
                            {reply.author.username
                              ? `@${reply.author.username}`
                              : reply.author.name}
                          </span>
                          <time className="text-[10px] text-zinc-600">
                            {new Date(reply.createdAt).toLocaleTimeString()}
                          </time>
                        </div>
                        <p className="text-xs break-words whitespace-pre-wrap text-zinc-400">
                          {reply.body}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {canChat ? (
                  <button
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 transition hover:text-emerald-400"
                    onClick={() => setReplyTo(message)}
                    type="button"
                  >
                    <CornerUpLeft className="size-3" />
                    {replies.length > 0
                      ? `Reply in thread (${replies.length})`
                      : "Reply in thread"}
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      {canChat ? (
        <form
          className="flex flex-col gap-2 border-t border-zinc-800 p-4"
          onSubmit={sendMessage}
        >
          {replyTo ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
              <p className="min-w-0 truncate text-xs text-zinc-500">
                Replying to{" "}
                <span className="font-semibold text-zinc-300">
                  {replyTo.author.username
                    ? `@${replyTo.author.username}`
                    : replyTo.author.name}
                </span>
                : {replyTo.body}
              </p>
              <button
                aria-label="Cancel reply"
                className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-300"
                onClick={() => setReplyTo(null)}
                type="button"
              >
                Cancel
              </button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              aria-label="Message"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
              maxLength={2000}
              onChange={(event) => setBody(event.target.value)}
              placeholder={
                replyTo
                  ? "Reply in thread…"
                  : "Message the community… use @username to mention someone"
              }
              value={body}
            />
            <button
              className="rounded-lg bg-emerald-500 px-3 text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-40"
              disabled={!connected || !body.trim()}
              type="submit"
            >
              <Send className="size-4" />
              <span className="sr-only">Send message</span>
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
};

// oxlint-disable-next-line complexity -- The route coordinates loading, auth, checkout, and live channel state.
const CommunityPage = () => {
  const { slug } = useParams({ from: "/communities/$slug" });
  const initialState = useLoaderData({ from: "/communities/$slug" });
  const navigate = useNavigate();
  const [state, setState] = useState<CommunityPageData | null>(initialState);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    initialState?.channels[0]?.id ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [members, setMembers] = useState<CommunityMembersData["members"]>([]);

  // Slack-style roster: any active member can browse the community list.
  useEffect(() => {
    let active = true;
    if (state?.membership?.status !== "active") {
      return;
    }
    const loadMembers = async () => {
      try {
        const response = await api.community.getMembers(slug);
        if (active) {
          setMembers(
            response.members.filter((member) => member.status === "active")
          );
        }
      } catch {
        // Roster is non-critical; the sidebar simply omits it.
      }
    };
    void loadMembers();
    return () => {
      active = false;
    };
  }, [slug, state?.membership?.status]);

  useEffect(() => {
    let active = true;
    const loadCommunity = async () => {
      try {
        const response = await api.community.get(slug);
        if (!active) {
          return;
        }
        setState(response);
        setActiveChannelId(response.channels[0]?.id ?? null);
        const sessionId = new URLSearchParams(window.location.search).get(
          "checkout_session_id"
        );
        if (sessionId) {
          try {
            await api.community.completePaidJoin(slug, sessionId);
            const refreshed = await api.community.get(slug);
            if (active) {
              setState(refreshed);
            }
          } catch {
            // A cancelled or incomplete Checkout session does not grant access.
          }
        }
      } catch (loadError: unknown) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Community not found"
          );
        }
      }
    };
    void loadCommunity();
    return () => {
      active = false;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center text-zinc-400">
        <h1 className="text-xl font-semibold text-white">
          Community unavailable
        </h1>
        <p className="mt-2">{error}</p>
        <Link className="mt-5 inline-block text-emerald-400" to="/">
          Return home
        </Link>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center text-zinc-500">
        Loading community…
      </div>
    );
  }

  const activeChannel =
    state.channels.find((channel) => channel.id === activeChannelId) ??
    state.channels[0];
  const canChat = state.membership?.status === "active";
  let joinLabel = "Join community";
  if (state.membership?.status === "pending") {
    joinLabel = "Request pending";
  }
  if (joining) {
    joinLabel = "Opening…";
  }
  const join = async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      await navigate({ to: "/auth/sign-in" });
      return;
    }
    setJoining(true);
    try {
      const response = await api.community.join(slug);
      if ("checkoutUrl" in response && response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }
      const refreshed = await api.community.get(slug);
      setState(refreshed);
    } catch (joinError: unknown) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "Unable to join community"
      );
    }
    setJoining(false);
  };

  return (
    <DbProvider client={communityDbClient}>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 py-6 lg:flex-row">
        <aside className="w-full shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 lg:w-72">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">
                {state.community.name}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {state.community.description ?? "A ParlayPal community"}
              </p>
            </div>
            {state.community.visibility === "private" ? (
              <Lock className="size-4 text-zinc-500" />
            ) : null}
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500">
            <Users className="size-4" />{" "}
            {state.community.access === "paid"
              ? `$${((state.community.priceCents ?? 0) / 100).toFixed(2)} to join`
              : "Free to join"}
          </div>
          {!canChat && (
            <button
              className="mt-5 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              disabled={joining}
              onClick={join}
              type="button"
            >
              {joinLabel}
            </button>
          )}
          <div className="mt-6 border-t border-zinc-800 pt-4">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
              Channels
            </p>
            <div className="space-y-1">
              {state.channels.map((channel) => (
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${channel.id === activeChannel?.id ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-400 hover:bg-zinc-800"}`}
                  key={channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                  type="button"
                >
                  # {channel.name}
                </button>
              ))}
            </div>
          </div>
          {canChat && members.length > 0 ? (
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                Members ({members.length})
              </p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {members.slice(0, 25).map((member) => (
                  <div
                    className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm"
                    key={member.user.id}
                  >
                    <span className="truncate text-zinc-300">
                      {member.user.username
                        ? `@${member.user.username}`
                        : member.user.name}
                    </span>
                    <span className="shrink-0 pl-2 text-[10px] text-zinc-600 capitalize">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {state.community.rules ? (
            <div className="mt-6 border-t border-zinc-800 pt-4">
              <p className="mb-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                Rules
              </p>
              <p className="text-xs whitespace-pre-wrap text-zinc-500">
                {state.community.rules}
              </p>
            </div>
          ) : null}
        </aside>
        {activeChannel ? (
          <ChannelMessages
            canChat={canChat}
            channel={activeChannel}
            communitySlug={slug}
            key={activeChannel.id}
          />
        ) : (
          <div className="flex-1 rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-zinc-500">
            No channels yet.
          </div>
        )}
      </main>
    </DbProvider>
  );
};

export const Route = createFileRoute("/communities/$slug")({
  loader: ({ params }) => loadPublicCommunity(params.slug),
  head: ({ loaderData, params }) => {
    const communityName =
      loaderData?.community.name ??
      params.slug
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    const title = `${communityName} Betting Community | ${SITE_NAME}`;
    const description =
      loaderData?.community.description ??
      `Join the ${communityName} betting community on ParlayPal to share picks, discuss live legs, and follow verified bet tracking.`;
    const url = absoluteUrl(`/communities/${encodeURIComponent(params.slug)}`);
    return {
      links: [{ href: url, rel: "canonical" }],
      meta: [
        { title },
        { content: description, name: "description" },
        ...socialMeta({ description, title, url }),
        ...(loaderData ? [] : [noIndexMeta]),
      ],
      scripts: loaderData
        ? [
            {
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "DiscussionForumPosting",
                about: loaderData.community.name,
                description,
                headline: loaderData.community.name,
                isPartOf: {
                  "@type": "WebSite",
                  name: SITE_NAME,
                  url: "https://myparlaypal.com",
                },
                url,
              }),
              type: "application/ld+json",
            },
          ]
        : [],
    };
  },
  component: CommunityPage,
});
