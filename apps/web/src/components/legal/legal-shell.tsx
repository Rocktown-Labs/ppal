import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface LegalShellProps {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}

export const LegalShell = ({
  children,
  description,
  eyebrow,
  title,
}: LegalShellProps) => (
  <div className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500 selection:text-black">
    <header className="border-b border-zinc-800/80 bg-zinc-950/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center" to="/">
          <img
            alt="ParlayPal"
            className="h-9 w-auto object-contain"
            src="/images/logo.png"
          />
        </Link>
        <Link
          className="text-xs font-semibold text-zinc-400 transition hover:text-white"
          to="/"
        >
          Back to ParlayPal
        </Link>
      </div>
    </header>

    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mb-12 max-w-3xl">
        <p className="text-xs font-bold tracking-[0.24em] text-emerald-400 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-8 text-zinc-400 sm:text-lg">
          {description}
        </p>
        <p className="mt-4 text-xs text-zinc-600">
          Last updated September 16, 2026
        </p>
      </div>

      <article className="space-y-10 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-10">
        {children}
      </article>
    </main>

    <footer className="border-t border-zinc-900 bg-black py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} ParlayPal. All rights reserved.</p>
        <nav className="flex gap-4">
          <Link className="transition hover:text-white" to="/terms">
            Terms of Service
          </Link>
          <Link className="transition hover:text-white" to="/privacy">
            Privacy Policy
          </Link>
          <a
            className="transition hover:text-white"
            href="mailto:support@myparlaypal.com"
          >
            Contact Support
          </a>
        </nav>
      </div>
    </footer>
  </div>
);
