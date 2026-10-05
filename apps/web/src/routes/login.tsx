import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/login` has moved to `/auth/sign-in` alongside every other auth view.
 * Keep this route as a redirect so existing links and bookmarks land on the
 * new path.
 */
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/sign-in" });
  },
});
