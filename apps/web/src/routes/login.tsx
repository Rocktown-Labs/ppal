import { createFileRoute, Link } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";

const RouteComponent = () => (
  <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12 text-zinc-100">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-zinc-950 to-zinc-950" />
    <div className="relative z-10 mb-8 flex flex-col items-center gap-2 text-center">
      <Link
        className="group flex items-center gap-2 transition hover:opacity-90"
        to="/"
      >
        <img
          src="/images/logo.png"
          alt="ParlayPal"
          className="h-14 w-auto object-contain"
        />
      </Link>
    </div>

    <div className="relative z-10 w-full max-w-md">
      <Auth socialLayout="vertical" socialPosition="top" view="signIn" />
    </div>
  </main>
);

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});
