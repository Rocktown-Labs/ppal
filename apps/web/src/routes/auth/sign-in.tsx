import { createFileRoute } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { redirectSignedInVisitor } from "@/lib/auth/redirect-signed-in-visitor";
import { noIndexMeta } from "@/lib/seo";

const SignInComponent = () => (
  <AuthShell>
    <Auth
      className="rounded-2xl border-white/10 bg-[#101412] shadow-2xl shadow-black/30"
      socialLayout="vertical"
      socialPosition="top"
      view="signIn"
    />
  </AuthShell>
);

export const Route = createFileRoute("/auth/sign-in")({
  beforeLoad: async () => await redirectSignedInVisitor(),
  head: () => ({ meta: [noIndexMeta] }),
  component: SignInComponent,
});
