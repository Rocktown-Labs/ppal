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
import {
  SITE_DESCRIPTION,
  SITE_LOGO_ICON_URL,
  SITE_LOGO_URL,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_TITLE,
} from "@/lib/seo";

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
          basePaths={{ settings: "/dashboard" }}
          redirectTo="/dashboard"
          viewPaths={{
            settings: { account: "settings", security: "settings" },
          }}
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
        href: SITE_LOGO_ICON_URL,
        rel: "icon",
        type: "image/png",
      },
      {
        href: "/apple-touch-icon.png",
        rel: "apple-touch-icon",
      },
      {
        href: "/site.webmanifest",
        rel: "manifest",
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
        title: SITE_TITLE,
      },
      {
        content: SITE_DESCRIPTION,
        name: "description",
      },
      {
        content: "#09090b",
        name: "theme-color",
      },
    ],
    scripts: [
      {
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_ORIGIN}/#organization`,
              description: SITE_DESCRIPTION,
              logo: SITE_LOGO_URL,
              name: SITE_NAME,
              url: SITE_ORIGIN,
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_ORIGIN}/#website`,
              description: SITE_DESCRIPTION,
              name: SITE_NAME,
              publisher: { "@id": `${SITE_ORIGIN}/#organization` },
              url: SITE_ORIGIN,
            },
          ],
        }),
        type: "application/ld+json",
      },
    ],
  }),

  server: {
    middleware: [createMiddleware().server(evlogErrorHandler)],
  },
});
