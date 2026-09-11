import { createFileRoute, Link, useParams } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";

const AuthRouteComponent = () => {
  const { path } = useParams({ from: "/auth/$path" });

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-zinc-950 to-zinc-950" />
      <div className="relative z-10 mb-8 flex flex-col items-center gap-2 text-center">
        <Link
          className="group flex items-center gap-2 transition hover:opacity-90"
          to="/"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 font-black text-black shadow-lg shadow-emerald-900/30">
            P
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Parlay<span className="text-emerald-400">Pal</span>
          </span>
        </Link>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Auth path={path} socialLayout="vertical" socialPosition="top" />
      </div>
    </main>
  );
};

export const Route = createFileRoute("/auth/$path")({
  component: AuthRouteComponent,
});
