import { createFileRoute, useParams } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { redirectSignedInVisitor } from "@/lib/auth/redirect-signed-in-visitor";
import { noIndexMeta } from "@/lib/seo";

const AuthRouteComponent = () => {
  const { path } = useParams({ from: "/auth/$path" });
  const isSignUp = path === "sign-up";

  return (
    <AuthShell
      eyebrow={isSignUp ? "GET STARTED" : "WELCOME BACK"}
      title={isSignUp ? "Create your account." : "Pick up where you left off."}
      description={
        isSignUp
          ? "Track every leg, score, and cashout opportunity in real time."
          : "Sign in to see your live tickets, progress, and notifications."
      }
    >
      <Auth
        className="rounded-2xl border-white/10 bg-[#101412] shadow-2xl shadow-black/30"
        path={path}
        socialLayout="vertical"
        socialPosition="top"
      />
    </AuthShell>
  );
};

// Entry views that should never be shown to an already-signed-in user. These
// mirror the default better-auth-ui `viewPaths` (`sign-in`, `sign-up`);
// `/auth/sign-in` is served by its own static route, so this guard only
// catches it if that route ever goes away.
const ENTRY_VIEW_PATHS = new Set(["sign-in", "sign-up"]);

export const Route = createFileRoute("/auth/$path")({
  beforeLoad: async ({ params }) => {
    if (ENTRY_VIEW_PATHS.has(params.path)) {
      await redirectSignedInVisitor();
    }
  },
  head: () => ({ meta: [noIndexMeta] }),
  component: AuthRouteComponent,
});
