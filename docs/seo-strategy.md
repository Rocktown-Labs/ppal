# ParlayPal SEO and GEO strategy

## Audit snapshot

ParlayPal has one primary public marketing page plus public profile and community routes. The dashboard, authentication flows, referral links, API, and private community content should not be indexed. The homepage is server-rendered and already contains useful, people-first copy. Public profile and community routes now load public records on the server for crawler-visible metadata, while client-side data loading remains for authenticated interactions.

## Implemented in this PR

- Unique homepage title, description, canonical, Open Graph, and Twitter metadata.
- Site-wide Organization and WebSite JSON-LD, plus homepage SoftwareApplication JSON-LD.
- Canonical and share metadata for public profile and community URLs.
- `noindex` metadata for dashboard and authentication routes.
- `robots.txt` with private/API exclusions and sitemap discovery.
- A conservative XML sitemap containing only the canonical homepage. Public profiles and communities should be added only from verified, indexable records rather than generated placeholders.
- `/llms.txt` and `/pricing.md` for extractable product and pricing context.

## Search intent map

| Intent | Canonical surface | Content requirement |
| --- | --- | --- |
| Live parlay tracker | `/` | Explain screenshot upload, leg normalization, live progress, and notifications. |
| Bet slip analyzer | `/` | Describe straight bets, player props, and multi-leg combinations plainly. |
| Betting record / hit rate | `/u/{username}` | Index only public profiles with real verified outcomes and a canonical username. |
| Betting communities | `/communities/{slug}` | Index only public communities with a description, rules, and at least one channel. |
| Pricing | `/#pricing`, `/pricing.md` | Keep prices and limits synchronized with billing configuration. |

## Programmatic SEO guardrails

Do not generate pages for every sport, player, league, or betting phrase without unique first-party data. When public scorecards and communities have enough verified activity, generate sitemap entries from the database, include updated timestamps, and link related profiles/communities from real navigation. Empty, private, or duplicate records should stay out of the sitemap.

## GEO/content guidance

Lead sections with direct answers, use descriptive headings, keep claims verifiable, and show update dates for pricing and product behavior. The code-owned `robots.txt` allows search and citation crawlers while keeping authenticated data, APIs, and private records blocked. Cloudflare may prepend account-level managed content-signal rules (the current preview does this for GPTBot, ClaudeBot, and Google-Extended); relax those rules in Cloudflare before launch if AI citation visibility is a goal. Measure traditional Search Console performance and sample AI citations monthly; AI results are non-deterministic, so compare repeated samples instead of single answers.
