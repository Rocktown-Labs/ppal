import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { UserButton } from "@/components/auth/user/user-button";
import { authClient } from "@/lib/auth-client";

const COVERED_SPORTS = [
  { detail: "NBA · WNBA · NCAA · Global", emoji: "🏀", name: "Basketball" },
  { detail: "NFL · NCAA · Global", emoji: "🏈", name: "Football" },
  { detail: "MLB · Global", emoji: "⚾", name: "Baseball" },
  { detail: "NHL · Global", emoji: "🏒", name: "Hockey" },
  { detail: "International Leagues", emoji: "⚽", name: "Soccer" },
  { detail: "UFC", emoji: "🥊", name: "MMA" },
  { detail: "ATP · WTA", emoji: "🎾", name: "Tennis" },
  { detail: "NASCAR · Formula 1", emoji: "🏎️", name: "Racing" },
  { detail: "PGA · LIV", emoji: "⛳", name: "Golf" },
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    description:
      "Snap a photo or upload a screenshot of your ticket, from any sportsbook.",
    step: "01",
    title: "Upload Your Slip",
  },
  {
    description:
      "ParlayPal normalizes players, teams, props, and line values so nothing gets lost.",
    step: "02",
    title: "ParlayPal Reads Every Leg",
  },
  {
    description:
      "Confirm the ticket and watch real-time stat progress on every single leg.",
    step: "03",
    title: "Track It Live",
  },
  {
    description:
      "Build an honest record of the players and markets you actually hit with most.",
    step: "04",
    title: "Know Your Hit Rate",
  },
] as const;

const FEATURES = [
  {
    description:
      "FanDuel, DraftKings, BetMGM, PrizePicks — every bet you place, tracked in one live view.",
    icon: "📱",
    title: "Sportsbook Independent",
  },
  {
    description:
      "Know your exact record whenever you pick Curry, Mahomes, or Ohtani — your history, not a guess.",
    icon: "📊",
    title: "Athlete Hit-Rate Analytics",
  },
  {
    description:
      "Watch progress bars fill in real time — 3 of 4 threes hit, 7 of 7.5 rebounds — as the game unfolds.",
    icon: "⚡",
    title: "Live In-Game Stat Progress",
  },
  {
    description:
      "Get alerted the moment a leg locks in early, or when you're one leg away from a win.",
    icon: "🔔",
    title: "Meaningful Milestones",
  },
  {
    description:
      "Your slip screenshots stay private. Dollar stakes and account details are never stored.",
    icon: "🔒",
    title: "Private & Secure",
  },
  {
    description:
      "See whether you hit more consistently on 2-leg, 3-leg, or 5+ leg parlays over time.",
    icon: "🎯",
    title: "Ticket-Size Breakdowns",
  },
] as const;

const HomeComponent = () => {
  const { data: session } = authClient.useSession();
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500 selection:text-black">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center">
            <img
              src="/images/logo.png"
              alt="ParlayPal"
              className="h-10 w-auto max-w-none object-contain sm:h-12"
            />
          </Link>

          <nav className="hidden items-center gap-8 text-xs font-semibold tracking-wider text-zinc-400 uppercase md:flex">
            <a href="#sports" className="transition-colors hover:text-white">
              Sports We Cover
            </a>
            <a
              href="#how-it-works"
              className="transition-colors hover:text-white"
            >
              How It Works
            </a>
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#analytics" className="transition-colors hover:text-white">
              Personal Analytics
            </a>
            <a href="#pricing" className="transition-colors hover:text-white">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-black shadow-md shadow-emerald-500/25 transition hover:bg-emerald-400"
                  >
                    Open Companion →
                  </button>
                </Link>
                <UserButton size="icon" variant="ghost" />
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:text-white"
                >
                  Log In
                </Link>
                <Link to="/login">
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-black shadow-md shadow-emerald-500/25 transition hover:bg-emerald-400"
                  >
                    Get Started Free
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-32">
        {/* Background Glow */}
        <div className="pointer-events-none absolute top-1/4 left-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Hero Copy */}
            <div className="space-y-6 text-center lg:col-span-7 lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Sportsbook-Independent Companion
              </div>

              <h1 className="text-4xl leading-tight font-black tracking-tight text-white sm:text-6xl">
                Never wonder if your parlay is hitting{" "}
                <br className="hidden sm:inline" />
                <span className="text-emerald-400">again.</span>
              </h1>

              <p className="mx-auto max-w-xl text-base text-zinc-400 sm:text-lg lg:mx-0">
                Upload a slip from FanDuel, DraftKings, BetMGM, or PrizePicks.
                ParlayPal reads every leg, tracks in-game stats as they happen,
                and turns your betting history into a hit-rate scorecard you can
                actually use.
              </p>

              <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row lg:justify-start">
                {isAuthenticated ? (
                  <Link to="/dashboard" className="w-full sm:w-auto">
                    <button
                      type="button"
                      className="w-full cursor-pointer rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-black shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
                    >
                      Go to Live Dashboard →
                    </button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="w-full sm:w-auto">
                      <button
                        type="button"
                        className="w-full cursor-pointer rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-black shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
                      >
                        Upload Your First Bet →
                      </button>
                    </Link>
                    <a href="#how-it-works" className="w-full sm:w-auto">
                      <button
                        type="button"
                        className="w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-900/60 px-6 py-3.5 text-sm font-semibold text-zinc-300 transition hover:text-white sm:w-auto"
                      >
                        See How It Works
                      </button>
                    </a>
                  </>
                )}
              </div>

              {/* Micro Trust Badges */}
              <div className="flex flex-wrap items-center justify-center gap-6 border-t border-zinc-800/80 pt-6 text-xs text-zinc-400 lg:justify-start">
                <span className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-400" />
                  Sportsbook Independent
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-400" />
                  ParlayPal-Powered Slip Reading
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-400" />
                  Pure Outcome Stats
                </span>
              </div>
            </div>

            {/* Right Live Companion Preview Mockup */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl ring-1 shadow-emerald-500/10 ring-white/10">
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                      <h3 className="text-sm font-bold text-white">
                        5-Leg NBA Parlay
                      </h3>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                      FanDuel • Live • Chase Center
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-400">
                    4 / 5 LEGS
                  </span>
                </div>

                {/* Legs Stream */}
                <div className="mt-4 space-y-3">
                  {/* Leg 1 (Won) */}
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                        ✓
                      </span>
                      <div>
                        <p className="font-bold text-white">Stephen Curry</p>
                        <p className="text-[11px] text-emerald-400">
                          Over 3.5 3PM (Hit 4)
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-emerald-400">
                      WON
                    </span>
                  </div>

                  {/* Leg 2 (Won) */}
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                        ✓
                      </span>
                      <div>
                        <p className="font-bold text-white">LeBron James</p>
                        <p className="text-[11px] text-emerald-400">
                          20+ Points (22 PTS)
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-emerald-400">
                      WON
                    </span>
                  </div>

                  {/* Leg 3 (Live - In Progress) */}
                  <div className="space-y-1.5 rounded-lg border border-zinc-700 bg-zinc-800/70 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                        </span>
                        <div>
                          <p className="font-bold text-white">LeBron James</p>
                          <p className="text-[11px] text-zinc-400">
                            Over 7.5 Rebounds
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        7 / 7.5
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: "93%" }}
                      />
                    </div>
                  </div>

                  {/* Leg 4 (Live Score) */}
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/40 p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-emerald-400" />
                      <div>
                        <p className="font-bold text-white">
                          Warriors Moneyline
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          GSW 88 - LAL 84 (Q3)
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-emerald-400">
                      LIVE
                    </span>
                  </div>

                  {/* Leg 5 (Upcoming) */}
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-800/20 p-2.5 text-xs text-zinc-400">
                    <div>
                      <p className="font-medium text-zinc-300">
                        Jayson Tatum Over 24.5 PTS
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Starts 8:00 PM
                      </p>
                    </div>
                    <span className="font-mono text-[10px] uppercase">
                      SCHEDULED
                    </span>
                  </div>
                </div>

                {/* Card Bottom Status */}
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-400">
                  <span className="font-semibold text-emerald-400">
                    👀 1 Leg Needed for Win
                  </span>
                  <span className="font-mono">Auto-syncing live</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sportsbook Trust Strip */}
      <section className="border-t border-zinc-800/80 bg-zinc-900/30 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 text-center sm:flex-row sm:gap-8 sm:px-6 lg:px-8">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            Works with every major sportsbook
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-bold text-zinc-300">
            <span className="transition-colors hover:text-white">FanDuel</span>
            <span className="transition-colors hover:text-white">
              DraftKings
            </span>
            <span className="transition-colors hover:text-white">BetMGM</span>
            <span className="transition-colors hover:text-white">
              PrizePicks
            </span>
            <span className="text-emerald-400">
              + any ticket you can screenshot
            </span>
          </div>
        </div>
      </section>

      {/* Sports We Cover Section */}
      <section id="sports" className="border-t border-zinc-800/80 py-20">
        <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
              Sports We Cover
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Every sport you bet, followed live
            </h2>
            <p className="text-sm text-zinc-400">
              From opening tip to final whistle, we track your legs across the
              sports you bet.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {COVERED_SPORTS.map((sport) => (
              <div
                key={sport.name}
                className="space-y-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center transition hover:border-zinc-700"
              >
                <span className="text-3xl">{sport.emoji}</span>
                <h3 className="text-sm font-bold text-white">{sport.name}</h3>
                <p className="text-[11px] text-zinc-500">{sport.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-t border-zinc-800/80 py-20">
        <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
              Frictionless Companion
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              From screenshot to live tracking in under a minute
            </h2>
            <p className="text-sm text-zinc-400">
              Four straightforward steps. No manual stat keeping, no switching
              between score apps.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <div
                key={step.step}
                className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-zinc-700"
              >
                <span className="font-mono text-2xl font-black text-emerald-400">
                  {step.step}
                </span>
                <h3 className="text-base font-bold text-white">{step.title}</h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="border-t border-zinc-800/80 bg-zinc-900/30 py-20"
      >
        <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Built around your picks, not the sportsbook&apos;s noise
            </h2>
            <p className="text-sm text-zinc-400">
              ParlayPal tracks selections and outcomes only — never your dollar
              amounts, and never any book&apos;s agenda.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition hover:border-zinc-700"
              >
                <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-lg text-emerald-400">
                  {feature.icon}
                </div>
                <h3 className="text-base font-bold text-white">
                  {feature.title}
                </h3>
                <p className="text-xs leading-relaxed text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Personal Analytics Section */}
      <section id="analytics" className="border-t border-zinc-800/80 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="space-y-6 text-center lg:text-left">
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
              Personal Analytics
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Your betting record, turned into insight
            </h2>
            <p className="mx-auto max-w-lg text-sm text-zinc-400 lg:mx-0">
              Most bettors have no idea which of their picks actually win over
              time. ParlayPal keeps the score across players, teams, sports, and
              markets — so you can bet your strengths, not your hopes.
            </p>
            <ul className="mx-auto max-w-md space-y-3 text-sm text-zinc-300 lg:mx-0">
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <span>Hit rate and streaks for every player you bet on</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <span>Performance by team, sport, market, and ticket size</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                <span>A clean history of every ticket, won or lost</span>
              </li>
            </ul>
          </div>

          {/* Analytics Scorecard Mockup */}
          <div className="mx-auto w-full max-w-md space-y-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl ring-1 shadow-emerald-500/10 ring-white/10">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">Player Hit Rates</h3>
              <span className="font-mono text-[11px] text-zinc-400">
                Last 90 days
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs">
              <div>
                <p className="font-bold text-white">Stephen Curry</p>
                <p className="text-[11px] text-zinc-400">
                  38 tickets • 3PM props
                </p>
              </div>
              <span className="font-mono text-sm font-black text-emerald-400">
                78%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs">
              <div>
                <p className="font-bold text-white">LeBron James</p>
                <p className="text-[11px] text-zinc-400">
                  27 tickets • PTS/Reb
                </p>
              </div>
              <span className="font-mono text-sm font-black text-emerald-400">
                63%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs">
              <div>
                <p className="font-bold text-white">Patrick Mahomes</p>
                <p className="text-[11px] text-zinc-400">
                  14 tickets • Pass Yds
                </p>
              </div>
              <span className="font-mono text-sm font-black text-emerald-400">
                71%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 text-xs">
              <div>
                <p className="font-bold text-white">Shohei Ohtani</p>
                <p className="text-[11px] text-zinc-400">
                  21 tickets • MLB props
                </p>
              </div>
              <span className="font-mono text-sm font-black text-emerald-400">
                66%
              </span>
            </div>
            <p className="pt-1 text-center text-[11px] text-zinc-500">
              Example data — your real hit rates appear here as you track
              tickets.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="border-t border-zinc-800/80 bg-zinc-900/30 py-20"
      >
        <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold tracking-wider text-emerald-400 uppercase">
              Pricing
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Start free. Upgrade when you&apos;re ready.
            </h2>
            <p className="text-sm text-zinc-400">
              From single parlays to complete historical archives — transparent
              pricing built for every sports bettor.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Free Tier */}
            <div className="flex flex-col justify-between space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-7">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">
                    ParlayPal Free
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Everything you need to feel the value.
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-black tracking-tight text-white">
                    $0
                  </span>
                  <span className="text-xs text-zinc-400">/forever</span>
                </div>

                <ul className="space-y-3 text-sm text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong>5</strong> tracked tickets / month
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>Live updates every 15 mins</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>Single historical slip upload</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>Basic player hit-rates</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>In-app notifications</span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-zinc-700"
                  >
                    {isAuthenticated ? "Continue Free" : "Get Started Free"}
                  </button>
                </Link>
              </div>
            </div>

            {/* Pro Tier (Popular) */}
            <div className="relative flex flex-col justify-between space-y-6 rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 to-zinc-900/80 p-7 shadow-xl shadow-emerald-500/10">
              <div className="absolute -top-3 right-6 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-black tracking-wide text-black uppercase">
                Most Popular
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">
                    ParlayPal Pro
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Unlimited tracking and the full picture.
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-4xl font-black tracking-tight text-white">
                      $12.99
                    </span>
                    <span className="text-xs text-zinc-400">/month</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-emerald-400">
                    Or $99.99/year ($8.33/mo) — Save 36%
                  </p>
                </div>

                <ul className="space-y-3 text-sm text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>
                      <strong>500</strong> ticket uploads / month
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>Fast 5-min live game updates</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>Full player, team & market analytics</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>Streak & ticket-size insights</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    <span>Email game alerts & priority processing</span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
                  >
                    {isAuthenticated
                      ? "Upgrade to Pro"
                      : "Get Started with Pro"}
                  </button>
                </Link>
              </div>
            </div>

            {/* Creator Tier */}
            <div className="relative flex flex-col justify-between space-y-6 rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-500/10 to-zinc-900/80 p-7 shadow-xl shadow-purple-500/10">
              <div className="absolute -top-3 right-6 rounded-full bg-purple-500 px-3 py-1 text-[11px] font-black tracking-wide text-white uppercase">
                For Creators
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">
                    ParlayPal Creator
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    Bulk imports & large historical records.
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-4xl font-black tracking-tight text-white">
                      $24.99
                    </span>
                    <span className="text-xs text-zinc-400">/month</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-purple-400">
                    Or $199.00/year ($16.58/mo) — Save 33%
                  </p>
                </div>

                <ul className="space-y-3 text-sm text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-purple-400" />
                    <span>
                      <strong>1,000</strong> ticket uploads / month
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-purple-400" />
                    <span>
                      <strong>Bulk historical archive imports</strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-purple-400" />
                    <span>Highest priority processing</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-purple-400" />
                    <span>Creator profile analytics</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-purple-400" />
                    <span>All Pro features included</span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 transition hover:bg-purple-500"
                  >
                    {isAuthenticated
                      ? "Upgrade to Creator"
                      : "Get Started with Creator"}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="border-t border-zinc-800 bg-gradient-to-b from-zinc-950 to-zinc-900 py-20">
        <div className="mx-auto max-w-4xl space-y-6 px-4 text-center">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            Upload your bet. Follow every leg. <br />
            <span className="text-emerald-400">Know when it hits.</span>
          </h2>

          <p className="mx-auto max-w-xl text-base text-zinc-400">
            Stop checking five different apps and box scores. ParlayPal pulls
            your slip, tracks live game progress in real time, and alerts you
            the moment you cash.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
            <Link to={isAuthenticated ? "/dashboard" : "/login"}>
              <button
                type="button"
                className="cursor-pointer rounded-xl bg-emerald-500 px-8 py-3.5 text-sm font-bold text-black shadow-xl shadow-emerald-500/30 transition hover:bg-emerald-400"
              >
                {isAuthenticated ? "Launch Dashboard →" : "Get Started Free →"}
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-black py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="space-y-4 md:col-span-2">
              <img
                src="/images/logo.png"
                alt="ParlayPal"
                className="h-8 w-auto max-w-none object-contain"
              />
              <p className="max-w-sm text-sm text-zinc-400">
                Your sportsbook-independent live bet companion. Upload your
                slip, follow every leg, and know the moment it hits.
              </p>
              <p className="text-xs text-zinc-600">
                © {new Date().getFullYear()} MyParlayPal.com · All rights
                reserved.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Product
              </h4>
              <nav className="flex flex-col gap-2.5 text-sm text-zinc-400">
                <a
                  href="#how-it-works"
                  className="transition-colors hover:text-emerald-400"
                >
                  How It Works
                </a>
                <a
                  href="#features"
                  className="transition-colors hover:text-emerald-400"
                >
                  Features
                </a>
                <a
                  href="#analytics"
                  className="transition-colors hover:text-emerald-400"
                >
                  Analytics
                </a>
                <a
                  href="#pricing"
                  className="transition-colors hover:text-emerald-400"
                >
                  Pricing
                </a>
              </nav>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-zinc-500 uppercase">
                Legal & Support
              </h4>
              <nav className="flex flex-col gap-2.5 text-sm text-zinc-400">
                <span className="text-zinc-500">Terms of Service</span>
                <span className="text-zinc-500">Privacy Policy</span>
                <a
                  href="mailto:support@myparlaypal.com"
                  className="transition-colors hover:text-emerald-400"
                >
                  Contact Support
                </a>
              </nav>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-6 sm:flex-row">
            <p className="text-xs text-zinc-500">
              ParlayPal is a sportsbook-independent tracking companion and not a
              gambling operator. Always gamble responsibly. 18+.
            </p>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="hover:text-zinc-400">Terms</span>
              <span>•</span>
              <span className="hover:text-zinc-400">Privacy</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const Route = createFileRoute("/")({
  component: HomeComponent,
});
