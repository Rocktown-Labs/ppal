import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="relative min-h-svh overflow-hidden bg-[#070a09] text-zinc-100 selection:bg-emerald-400 selection:text-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(16,185,129,0.15),transparent_31%),radial-gradient(circle_at_86%_84%,rgba(16,185,129,0.09),transparent_27%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:48px_48px] opacity-[0.035]"
      />

      <div className="relative grid min-h-svh lg:grid-cols-[minmax(22rem,0.9fr)_minmax(28rem,1.1fr)]">
        <aside className="relative hidden min-h-svh border-r border-white/10 bg-white/[0.015] lg:flex">
          <div className="flex w-full flex-col p-8 xl:p-12">
            <Link to="/" className="inline-flex w-fit items-center">
              <img
                src="/images/logo.png"
                alt="ParlayPal"
                className="h-11 w-auto object-contain"
              />
            </Link>

            <div className="my-auto max-w-xl py-16">
              <p className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
                <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
                Live betting desk
              </p>
              <h1 className="mt-6 max-w-lg text-5xl leading-[0.98] font-semibold tracking-[-0.055em] text-white xl:text-7xl">
                Keep the ticket
                <span className="block text-emerald-400">moving.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-zinc-400 xl:text-lg">
                Upload a slip once. ParlayPal follows each leg, the score, and
                the moments that change your night.
              </p>

              <div className="relative mt-10 max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.18em] text-zinc-500 uppercase">
                      Live tracker
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      Sunday night card
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Live
                  </span>
                </div>

                <div className="mt-7 flex items-end justify-between gap-6">
                  <div
                    className="flex h-14 flex-1 items-end gap-1.5"
                    aria-hidden="true"
                  >
                    <span className="h-5 flex-1 rounded-t bg-emerald-400/30" />
                    <span className="h-9 flex-1 rounded-t bg-emerald-400/50" />
                    <span className="h-7 flex-1 rounded-t bg-emerald-400/40" />
                    <span className="h-12 flex-1 rounded-t bg-emerald-400" />
                    <span className="h-10 flex-1 rounded-t bg-emerald-300/80" />
                    <span className="h-14 flex-1 rounded-t bg-emerald-300" />
                    <span className="h-11 flex-1 rounded-t bg-emerald-400/70" />
                    <span className="h-8 flex-1 rounded-t bg-emerald-400/40" />
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-semibold tracking-[-0.06em] text-white">
                      3<span className="text-zinc-600">/</span>5
                    </p>
                    <p className="mt-1 text-[10px] font-bold tracking-[0.16em] text-emerald-300 uppercase">
                      legs hit
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-xs">
                  <div className="rounded-xl bg-white/5 px-3 py-2.5">
                    <p className="text-zinc-500">Next up</p>
                    <p className="mt-1 font-semibold text-zinc-200">NFL · Q3</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2.5">
                    <p className="text-zinc-500">Status</p>
                    <p className="mt-1 font-semibold text-emerald-300">
                      On pace
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-5 text-xs text-zinc-600">
              <span>Built for the sweat.</span>
              <span className="font-mono tracking-[0.16em] uppercase">
                PP / 01
              </span>
            </div>
          </div>
        </aside>

        <section className="relative flex min-h-svh items-center justify-center px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
          <div className="w-full max-w-md">
            <Link to="/" className="mb-10 inline-flex lg:hidden">
              <img
                src="/images/logo.png"
                alt="ParlayPal"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <div className="mb-7">
              <p className="text-[11px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
                Welcome back
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                Pick up where you left off.
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                Sign in to see your live tickets, progress, and notifications.
              </p>
            </div>

            {children}

            <p className="mt-6 text-center text-[11px] leading-5 text-zinc-600">
              By continuing, you agree to the ParlayPal terms and privacy
              policy.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
