import { DbProvider, useLiveQuery } from "@tanstack/react-db";
import {
  createFileRoute,
  Link,
  useLoaderData,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { Lock, MessageCircle, Send, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL, api } from "@/lib/api";
import type { CommunityChannel, CommunityMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  communityDbClient,
  communityMessageCollection,
  removeCommunityMessage,
  upsertCommunityMessage,
} from "@/lib/community-db";
import { absoluteUrl, noIndexMeta, SITE_NAME, socialMeta } from "@/lib/seo";

type CommunityPageData = Awaited<ReturnType<typeof api.community.get>>;

const loadPublicCommunity = async (
  slug: string
): Promise<CommunityPageData | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/communities/${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as CommunityPageData;
    return payload.community && Array.isArray(payload.channels)
      ? payload
      : null;
  } catch {
    return null;
  }
};

const messageToRow = (channelId: string, message: CommunityMessage) => ({
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
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const { data = [] } = useLiveQuery(communityMessageCollection);
  const messages = useMemo(
    () =>
      data
        .filter((message) => message.channelId === channel.id)
        .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [channel.id, data]
  );

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
      } catch {
        // Public history can be unavailable for a private channel.
      }
    };
    void loadMessages();
    return () => {
      active = false;
    };
  }, [channel.id, communitySlug]);

  useEffect(() => {
    if (!canChat) {
      return;
    }
    const socketUrl = new URL(
      `/api/v1/communities/${encodeURIComponent(communitySlug)}/channels/${encodeURIComponent(channel.id)}/ws`,
      API_BASE_URL
    );
    socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;
    const handleOpen = () => setConnected(true);
    const handleClose = () => setConnected(false);
    const handleError = () => setConnected(false);
    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as {
          message?: CommunityMessage;
          messageId?: string;
          type?: string;
        };
        if (payload.type === "delete" && payload.messageId) {
          removeCommunityMessage(payload.messageId);
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
    };
    socket.addEventListener("open", handleOpen);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("message", handleMessage);
      socket.close();
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
    const optimistic: CommunityMessage = {
      author: { avatarUrl: null, name: "You", username: null },
      body: trimmed,
      clientId,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      editedAt: null,
      id: clientId,
      mentions: [],
      replyToId: null,
    };
    upsertCommunityMessage(messageToRow(channel.id, optimistic));
    socketRef.current.send(
      JSON.stringify({ body: trimmed, clientId, type: "message" })
    );
    setBody("");
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
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-zinc-500">
            <MessageCircle className="mb-2 size-8" />
            <p>No messages yet.</p>
            {canChat ? (
              <p className="text-xs">Start the conversation.</p>
            ) : null}
          </div>
        ) : (
          messages.map((message) => (
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
            </article>
          ))
        )}
      </div>
      {canChat ? (
        <form
          className="flex gap-2 border-t border-zinc-800 p-4"
          onSubmit={sendMessage}
        >
          <input
            aria-label="Message"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Message the community… use @username to mention someone"
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
      await navigate({ to: "/login" });
      return;
    }
    setJoining(true);
    try {
      const response = await api.community.join(slug);
      if (response.checkoutUrl) {
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
