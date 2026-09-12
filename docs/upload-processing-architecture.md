# Upload processing architecture

This is the implemented Cloudflare upload path for live slips and Creator historical batches. Every asynchronous transition is persisted before it is queued, and every side effect has an idempotency key.

```mermaid
flowchart TD
  Client[Web or Expo client] -->|metadata + SHA-256 + idempotency key| API[Hono API Worker]
  API --> Rate[Cloudflare Rate Limiting]
  Rate -->|conditional quota reservation| D1[(Cloudflare D1)]
  D1 -->|upload intent| Client
  Client -->|authenticated streaming PUT| API
  API -->|digest-checked private object| R2[(Private R2 bucket)]
  API -->|uploadId only| ExtractQ[[Extraction Queue]]

  ExtractQ --> Extract[Idempotent extraction consumer]
  Extract -->|read private object| R2
  Extract -->|schema-constrained image request| Gemini[Gemini 3.8 Flash]
  Gemini -->|heterogeneous legs + compound components| Extract
  Extract -->|raw response + normalized ticket + legs| D1
  Extract --> NotifyQ[[Notification Queue]]
  NotifyQ --> Delivery[Delivery consumer]
  Delivery --> Resend[Resend email]
  Delivery --> Expo[Expo push]
  Delivery --> WebPush[Encrypted Web Push]
  WebPush --> PushService[Browser push service]
  PushService --> SW[Web service worker]
  SW --> OS[Browser/OS notification]
  D1 --> SSE[SSE notification stream]
  SSE --> Client

  Client -->|review mappings and confirm| API
  API -->|tracking subscriptions| D1
  Cron[Cloudflare Cron] -->|claim due shared events| SportsQ[[Sports Queue]]
  SportsQ --> Sports[Sports consumer]
  Sports --> Sportradar[Sportradar]
  Sports -->|deduplicated observations + deterministic settlement| D1
  Sports --> NotifyQ

  ExtractQ -. terminal failure .-> Failure[(Operational failure ledger)]
  SportsQ -. terminal failure .-> Failure
  NotifyQ -. terminal failure .-> Failure
  Ops[Authenticated recovery API] -->|inspect, repair lease/state, replay| Failure
  Ops --> ExtractQ
  Ops --> SportsQ
  Ops --> NotifyQ

  Batch[Historical batch intent] --> API
  API -->|up to 100 independently idempotent files| D1
  D1 -->|progress, duplicates, review, verified counts| Client
  Sports -->|final provider result| Verify[Verified historical record]
  Verify --> D1
```

## Reliability boundaries

- D1 is the source of truth; queue messages contain identifiers, never images or secrets.
- Upload quota reservation, SHA-256 deduplication, observation identity, timeline transitions, referrals, webhook receipts, and notification delivery all have unique idempotency keys.
- R2 is private and stores only server-generated object keys. The upload endpoint validates ownership, declared length, MIME type, and the SHA-256 digest supplied at intent creation.
- A sports event is fetched once per polling interval and fans out to every subscribed leg. This is the key scaling property: provider traffic grows with active events, not users.
- Terminal queue failures are written to `operation_failures`. Replay repairs extraction state/quota or sports leases before enqueueing again, rather than blindly duplicating work.
- Live updates use reconnectable SSE backed by durable notification rows. Email, Expo push, and encrypted browser Web Push delivery run independently through the notification queue; expired browser subscriptions are pruned automatically.
- Browser push subscriptions are authenticated, stored per user in D1, and accepted only for known HTTPS push-service hosts. The VAPID private key is a Worker secret; the public key is returned only to authenticated clients for subscription.

## Provider coverage

The catalog includes NBA, WNBA, NCAA basketball, NFL, NCAA football, MLB, NHL, soccer, tennis, MMA, global basketball/football/baseball/hockey, NASCAR, Formula 1, and PGA. The configured Sportradar key currently authorizes the tested NBA and MLB feeds. It returns `403` for the tested NFL, NHL, soccer, tennis, MMA, global basketball, NASCAR, Formula 1, and PGA products. Those adapters are implemented and fixture-tested, but production calls require those product entitlements on the provider account.
