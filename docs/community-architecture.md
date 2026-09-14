# Communities architecture

```mermaid
flowchart LR
  Browser[Web browser / TanStack Start]
  API[ppal-server Hono API]
  D1[(Cloudflare D1\ncommunities, channels, members, messages)]
  DO[CommunityChannelRoom Durable Object\none per community:channel\nhibernatable WebSockets]
  RL1[HTTP rate limit binding]
  RL2[Chat rate limit binding]
  Stripe[Stripe Checkout\none-time paid membership]
  Notify[Notification table + existing SSE feed]

  Browser -->|GET public community| API
  Browser -->|create/join/moderate| API
  API --> D1
  API --> RL1
  API -->|paid join| Stripe
  Browser -->|WebSocket upgrade| API
  API -->|validated identity + room headers| DO
  DO -->|membership + channel validation| D1
  DO --> RL2
  DO -->|insert before broadcast| D1
  DO -->|fan out message/delete| Browser
  DO -->|mention rows| Notify
  Browser -->|SSE notifications| API
```

The Durable Object is a coordination and fan-out layer, not a second source of truth. Every accepted message is written to D1 before it is broadcast. Objects are named deterministically by `communityId:channelId`, so busy channels shard across objects and idle channels hibernate. The API authenticates and authorizes the WebSocket upgrade before forwarding it to the object; the object rechecks membership on every message.

Public communities expose channel metadata and message history without a session. Private communities return `404` to non-members to avoid leaking their existence. Only users with an active Creator entitlement can create a community. Paid membership uses a real Stripe Checkout session and is activated only after the server verifies the completed, paid session metadata.
