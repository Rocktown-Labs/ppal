import { Toaster } from "@ppal/ui/components/sonner";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { createMiddleware } from "@tanstack/react-start";
import { evlogErrorHandler } from "evlog/nitro/v3";

import { AuthProvider } from "@/components/auth/auth-provider";
import { authClient } from "@/lib/auth-client";

import appCss from "../index.css?url";

export type RouterAppContext = Record<string, unknown>;

const TanStackLinkAdapter = ({
  href,
  ...props
}: {
  href: string;
  [key: string]: unknown;
}) => <Link to={href} {...props} />;

const RootDocument = () => {
  const navigate = useNavigate();

  return (
    <html className="dark" lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-emerald-500 selection:text-black">
        <AuthProvider
          Link={TanStackLinkAdapter}
          authClient={authClient}
          redirectTo="/dashboard"
          navigate={({ to, replace }) => {
            void navigate({ replace, to });
          }}
        >
          <Outlet />
        </AuthProvider>
        <Toaster richColors />
        {import.meta.env.DEV ? (
          <TanStackRouterDevtools position="bottom-left" />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootDocument,

  head: () => ({
    links: [
      {
        href: appCss,
        rel: "stylesheet",
      },
      {
        href: "/favicon.ico",
        rel: "icon",
        sizes: "any",
      },
      {
        href: "/favicon.svg",
        rel: "icon",
        type: "image/svg+xml",
      },
      {
        href: "/apple-touch-icon.png",
        rel: "apple-touch-icon",
      },
    ],
    meta: [
      {
        charSet: "utf-8",
      },
      {
        content: "width=device-width, initial-scale=1",
        name: "viewport",
      },
      {
        title: "ParlayPal — Sportsbook-Independent Live Bet Companion",
      },
      {
        content:
          "ParlayPal tracks every leg of your sports parlays live, independently of any sportsbook. Upload your slip, follow stat progress in real time, and build your personal hit-rate history.",
        name: "description",
      },
    ],
  }),

  server: {
    middleware: [createMiddleware().server(evlogErrorHandler)],
  },
});
