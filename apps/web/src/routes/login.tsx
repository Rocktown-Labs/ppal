import { createFileRoute, redirect } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { noIndexMeta } from "@/lib/seo";

const RouteComponent = () => (
  <AuthShell>
    <Auth
      className="border-white/10 bg-[#101412] shadow-2xl shadow-black/30"
      socialLayout="grid"
      socialPosition="top"
      view="signIn"
    />
  </AuthShell>
);

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      return;
    }
    let profile: Awaited<
      ReturnType<typeof api.community.getMe>
    >["user"]["profile"];
    try {
      const response = await api.community.getMe();
      const { profile: currentProfile } = response.user;
      profile = currentProfile;
    } catch {
      // If the API is briefly unavailable, leave the auth form usable.
      return;
    }
    throw redirect({
      to: profile?.username?.trim() ? "/dashboard" : "/dashboard/onboarding",
    });
  },
  head: () => ({ meta: [noIndexMeta] }),
  component: RouteComponent,
});
