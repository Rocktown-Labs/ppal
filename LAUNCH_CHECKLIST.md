# Launch Checklist — What's Left

Production is live at `bbab251`. Everything below is either carrier/compliance review (time-boxed on a third party's side) or a decision we haven't made yet.

---

## 1. SMS — Sent.dm 10DLC registration (blocking)

US SMS cannot send until a 10DLC brand + campaign is approved. Sent.dm files the TCR registration for us; approval is typically **1–3 business days**.

**Do this in Sent.dm dashboard → Compliance → US 10DLC → Apply.**

| Field | Value |
| --- | --- |
| Brand name | `ParlayPal` (how users know us, not the LLC legal name) |
| Use case | `Customer care` — ticket updates (or Low-volume mixed) |
| Campaign description | "ParlayPal sends real-time ticket settlement and stat-progress updates to users who opt in to SMS alerts for their tracked betting slips." |
| Opt-in method | "Users opt in via an unchecked SMS-alerts checkbox in the ParlayPal app's notification settings and onboarding flow, with phone number entry." |
| Message frequency | `Max 30 msgs/mo` |
| Sample message 1 | `ParlayPal: Ticket won — Steph Curry Three-Pointers 3/3.` |
| Sample message 2 | `ParlayPal: Celtics moneyline — Away 95, Home 100.` |

Also provide the **3 required autoresponses** (HELP, STOP, unsubscribe-confirm) when the form prompts for them.

**Why SMS is settlement-only:** the app now sends SMS only for terminal results (`ticket.won` / `lost` / `push` / `settled` / `partially_void` / `void`) so real volume stays under the registered `Max 30 msgs/mo` cap. Progress ticks, extraction notices, and mentions stay in-app/push/email only.

---

## 2. SMS — Template + final wiring (after 10DLC approval)

1. Create a template in Sent.dm (category `UTILITY`), named **`ticket_update`**:

   ```text
   ParlayPal: {{title}} - {{body}}. Open the app for details.
   ```

   Variables (names must be exactly `title` and `body`):

   | id  | name  | type     | variableType | sample                           |
   | --- | ----- | -------- | ------------ | -------------------------------- |
   | 0   | title | variable | text         | `Ticket won`                     |
   | 1   | body  | variable | text         | `Steph Curry Three-Pointers 2/3` |

2. Submit for review. No WhatsApp Business Account is needed — Sent's compliance team approves the **SMS** channel on its own.

3. Once approved, tell the agent the template name and it will:
   - set the repo variable `SENT_DM_TEMPLATE_NAME = ticket_update`
   - trigger the production deploy

The code already sends named template params `title` + `body` and falls back to free-form text when `SENT_DM_TEMPLATE_NAME` is unset.

---

## 3. Email — Resend domain verification

From-email is now `noreply@bets.myparlaypal.com` (reply-to `support@bets.myparlaypal.com`), set as repo variables and shipped in `bbab251`.

**Verify `bets.myparlaypal.com` in Resend** (add its SPF + DKIM DNS records). Until verified, emails from that domain bounce or land in spam.

---

## 4. Sports providers — decisions to make

- **MLB (baseball)** — Sportradar MLB trial expired. Plan: start a balldontlie trial (48h GOAT, then convert to ALL-STAR $9.99/mo for scores + player stats). Build a balldontlie provider behind the per-league flag; Sportradar keeps NFL.
- **NBA** — basketball is offseason; trial also expired. Revisit before the mid-October tip-off with the same provider pattern.
- **NFL (current)** — Sportradar trial live; `SPORTRADAR_LEAGUES=nfl` is set so schedule sync skips dead trials. Watch quota via `sportradar.poll_failed` analytics (failure backoff is in place).

---

## 5. Reference — secrets/vars state

**Set (repo):** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `DATA_ENCRYPTION_KEY`, `SENT_DM_API_KEY`

**Set (production env):** `BETTER_AUTH_SECRET`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `OPERATIONS_API_TOKEN`, `REVENUECAT_WEBHOOK_SECRET`, `SPORTRADAR_API_KEY`, `STRIPE_*` (six), plus the Stripe price IDs.

**Set (repo vars):** `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL`, `SPORTRADAR_LEAGUES`

**Still optional/unset (flow silently degrades):** `WEB_PUSH_VAPID_PRIVATE_KEY` (browser push), `APPLE_*` / `FACEBOOK_*` OAuth, `SENT_DM_TEMPLATE_NAME` (set after 10DLC approval).

---

## 6. Final smoke test (after SMS + email go live)

- Create a ticket → confirm extraction notification (in-app + email).
- Live track a settling ticket → terminal SMS + push + email fire once; no progress-tick SMS.
- Free user: email + push only, no SMS. Pro/Creator with phone + opt-in: SMS.
- Moneyline ticket SMS shows score; player-prop SMS shows `x/y` progress.
- Confirm email arrives from `bets.myparlaypal.com`.
