import { createFileRoute, useParams } from "@tanstack/react-router";

import { Auth } from "@/components/auth/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { noIndexMeta } from "@/lib/seo";

const AuthRouteComponent = () => {
  const { path } = useParams({ from: "/auth/$path" });

  return (
    <AuthShell>
      <Auth
        className="border-white/10 bg-[#101412] shadow-2xl shadow-black/30"
        path={path}
        socialLayout="grid"
        socialPosition="top"
      />
    </AuthShell>
  );
};

export const Route = createFileRoute("/auth/$path")({
  head: () => ({ meta: [noIndexMeta] }),
  component: AuthRouteComponent,
});
