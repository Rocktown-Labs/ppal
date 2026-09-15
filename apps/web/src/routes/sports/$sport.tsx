import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronRight } from "lucide-react";

import { UserButton } from "@/components/auth/user/user-button";
import { getSportPage } from "@/data/sports";
import type { SportPage } from "@/data/sports";
import { authClient } from "@/lib/auth-client";
import {
  absoluteUrl,
  noIndexMeta,
  SITE_DESCRIPTION,
  SITE_OG_IMAGE_URL,
  SITE_NAME,
  SITE_ORIGIN,
  socialMeta,
} from "@/lib/seo";

const buildRelatedPages = (page: SportPage): SportPage[] =>
  page.relatedSlugs.flatMap((slug) => {
    const relatedPage = getSportPage(slug);
    return relatedPage ? [relatedPage] : [];
  });

const SportPageComponent = () => {
  const { sport } = useParams({ from: "/sports/$sport" });
  const { data: session } = authClient.useSession();
  const page = getSportPage(sport);

  if (!page) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
        <div className="max-w-md space-y-4">
          <p className="text-sm font-semibold tracking-[0.24em] text-emerald-400 uppercase">
            Sport page not found
          </p>
          <h1 className="text-3xl font-black">That sport is not available.</h1>
          <p className="text-sm text-zinc-400">
            Browse the sports ParlayPal currently supports or return to the
            homepage.
          </p>
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black"
            to="/"
          >
            Back to ParlayPal <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
    );
  }

  const relatedPages = buildRelatedPages(page);
  const destination = session?.user ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500 selection:text-black">
      <header className="border-b border-zinc-800/80 bg-zinc-950/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center" to="/">
            <img
              alt="ParlayPal"
              className="h-10 w-auto object-contain sm:h-12"
              src="/images/logo.png"
            />
          </Link>
          <nav className="flex items-center gap-3 text-xs font-semibold text-zinc-400 sm:gap-6">
            <Link
              className="hidden transition-colors hover:text-white sm:inline"
              to="/"
            >
              How it works
            </Link>
            <a
              className="hidden transition-colors hover:text-white sm:inline"
              href={`${SITE_ORIGIN}/#pricing`}
            >
              Pricing
            </a>
            {session?.user ? (
              <>
                <Link
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black transition hover:bg-emerald-400"
                  to="/dashboard"
                >
                  Open Dashboard
                </Link>
                <UserButton size="icon" variant="ghost" />
              </>
            ) : (
              <>
                <Link
                  className="transition-colors hover:text-white"
                  to="/login"
                >
                  Log in
                </Link>
                <Link
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black transition hover:bg-emerald-400"
                  to="/login"
                >
                  Start free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-zinc-800/80 py-16 sm:py-24">
          <div className="pointer-events-none absolute top-0 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <nav
              aria-label="Breadcrumb"
              className="mb-8 flex items-center gap-2 text-xs text-zinc-500"
            >
              <Link className="transition-colors hover:text-white" to="/">
                ParlayPal
              </Link>
              <ChevronRight className="size-3" />
              <span>{page.name}</span>
            </nav>
            <div className="max-w-3xl space-y-6">
              <p className="text-xs font-bold tracking-[0.24em] text-emerald-400 uppercase">
                {page.eyebrow}
              </p>
              <h1 className="text-4xl leading-tight font-black tracking-tight text-white sm:text-6xl">
                {page.headline}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                {page.intro}
              </p>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Link
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-black shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
                  to={destination}
                >
                  Upload a {page.name} bet <ArrowRight className="size-4" />
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/60 px-6 py-3.5 text-sm font-semibold text-zinc-300 transition hover:text-white"
                  to="/"
                  hash="how-it-works"
                >
                  See how it works
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-zinc-800/80 pt-6 text-xs text-zinc-400">
                <span className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  Any sportsbook screenshot
                </span>
                <span className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  Player and team legs
                </span>
                <span className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-400" />
                  Scheduled live updates
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-800/80 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div className="space-y-4">
              <p className="text-xs font-bold tracking-[0.24em] text-emerald-400 uppercase">
                What you can track
              </p>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                One view for every {page.name.toLowerCase()} leg
              </h2>
              <p className="text-sm leading-7 text-zinc-400">
                ParlayPal extracts the selection first, then connects it to the
                right event and live market. You review the ticket before
                tracking starts, so the scorecard reflects what you actually
                bet.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {page.leagues.map((league) => (
                  <span
                    className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300"
                    key={league}
                  >
                    {league}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {page.markets.map((market) => (
                <article
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
                  key={market.name}
                >
                  <h3 className="text-base font-bold text-white">
                    {market.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {market.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-800/80 bg-zinc-900/30 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl space-y-3">
              <p className="text-xs font-bold tracking-[0.24em] text-emerald-400 uppercase">
                Built for live decisions
              </p>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Know what changed without checking five apps
              </h2>
              <p className="text-sm leading-7 text-zinc-400">
                Each update keeps the event state and your line together. Turn
                on the channels and milestones you want, then let ParlayPal send
                the useful change at your chosen interval.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {page.trackingExamples.map((example) => (
                <div
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5"
                  key={example.label}
                >
                  <p className="text-sm font-bold text-white">
                    {example.label}
                  </p>
                  <p className="mt-3 font-mono text-sm text-emerald-400">
                    {example.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-800/80 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl space-y-8 px-4 sm:px-6 lg:px-8">
            <div className="space-y-3 text-center">
              <p className="text-xs font-bold tracking-[0.24em] text-emerald-400 uppercase">
                {page.name} bet tracking FAQ
              </p>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Questions before you upload
              </h2>
            </div>
            <div className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-6">
              {page.faq.map((item) => (
                <details className="group py-5" key={item.question}>
                  <summary className="cursor-pointer list-none pr-8 text-sm font-semibold text-white marker:hidden">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-4xl space-y-8 px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
              Upload the ticket. Follow the {page.name.toLowerCase()} action.
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-7 text-zinc-400">
              ParlayPal is a tracking companion, not a sportsbook. It does not
              accept wagers or hold funds; it helps you understand the bets you
              already placed.
            </p>
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-bold text-black shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
              to={destination}
            >
              Create your free account <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <section className="border-t border-zinc-800/80 bg-zinc-900/30 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-xs font-bold tracking-[0.24em] text-zinc-500 uppercase">
              Explore more sports
            </h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {relatedPages.map((relatedPage) => (
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-emerald-500/50 hover:text-white"
                  key={relatedPage.slug}
                  params={{ sport: relatedPage.slug }}
                  to="/sports/$sport"
                >
                  {relatedPage.emoji} {relatedPage.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-900 bg-black py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link className="font-semibold text-zinc-300" to="/">
            ParlayPal
          </Link>
          <p>{SITE_DESCRIPTION}</p>
        </div>
      </footer>
    </div>
  );
};

export const Route = createFileRoute("/sports/$sport")({
  head: ({ params }) => {
    const page = getSportPage(params.sport);
    if (!page) {
      return { meta: [noIndexMeta] };
    }

    const pageUrl = absoluteUrl(`/sports/${page.slug}`);
    return {
      links: [{ href: pageUrl, rel: "canonical" }],
      meta: [
        { title: `${page.name} Bet Tracker & Live Updates | ${SITE_NAME}` },
        { content: page.metaDescription, name: "description" },
        ...socialMeta({
          description: page.metaDescription,
          title: `${page.name} Bet Tracker & Live Updates | ${SITE_NAME}`,
          url: pageUrl,
        }),
      ],
      scripts: [
        {
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            about: {
              "@type": "Thing",
              name: `${page.name} betting`,
            },
            description: page.metaDescription,
            headline: page.headline,
            image: SITE_OG_IMAGE_URL,
            isPartOf: {
              "@type": "WebSite",
              name: SITE_NAME,
              url: SITE_ORIGIN,
            },
            name: `${page.name} Bet Tracker | ${SITE_NAME}`,
            url: pageUrl,
          }),
          type: "application/ld+json",
        },
        {
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                item: SITE_ORIGIN,
                name: SITE_NAME,
                position: 1,
              },
              {
                "@type": "ListItem",
                item: pageUrl,
                name: page.name,
                position: 2,
              },
            ],
          }),
          type: "application/ld+json",
        },
        {
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faq.map((item) => ({
              "@type": "Question",
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
              name: item.question,
            })),
          }),
          type: "application/ld+json",
        },
      ],
    };
  },
  component: SportPageComponent,
});
