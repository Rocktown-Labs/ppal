import { createFileRoute, useParams } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { redirectSignedInVisitor } from "@/lib/auth/redirect-signed-in-visitor";
import { noIndexMeta } from "@/lib/seo";

const AUTH_VIEW_COPY: Record<
  string,
  { description: string; eyebrow: string; pageTitle: string; title: string }
> = {
  "forgot-password": {
    description:
      "Enter your email address and we'll send you a link to reset your password.",
    eyebrow: "ACCOUNT RECOVERY",
    pageTitle: "Reset Password | ParlayPal",
    title: "Reset your password.",
  },
  "reset-password": {
    description: "Choose a strong new password for your ParlayPal account.",
    eyebrow: "ACCOUNT RECOVERY",
    pageTitle: "Set New Password | ParlayPal",
    title: "Set a new password.",
  },
  "sign-up": {
    description:
      "Upload your slips, follow every leg live, and build your personal hit-rate scorecard.",
    eyebrow: "GET STARTED",
    pageTitle: "Sign Up | ParlayPal",
    title: "Create your account.",
  },
};

const DEFAULT_AUTH_COPY = {
  description: "Sign in to see your live tickets, progress, and notifications.",
  eyebrow: "WELCOME BACK",
  pageTitle: "Sign In | ParlayPal",
  title: "Pick up where you left off.",
};

const AuthRouteComponent = () => {
  const { path } = useParams({ from: "/auth/$path" });
  const copy = AUTH_VIEW_COPY[path] ?? DEFAULT_AUTH_COPY;

  return (
    <AuthShell
      description={copy.description}
      eyebrow={copy.eyebrow}
      showLegalFooter={false}
      title={copy.title}
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
  head: ({ params }) => ({
    meta: [
      { title: (AUTH_VIEW_COPY[params.path] ?? DEFAULT_AUTH_COPY).pageTitle },
      noIndexMeta,
    ],
  }),
  component: AuthRouteComponent,
});
