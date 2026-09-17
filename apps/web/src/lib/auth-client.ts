import { passkeyClient } from "@better-auth/passkey/client";
import { stripeClient } from "@better-auth/stripe/client";
import { env } from "@ppal/env/web";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { normalizeServerUrl, resolveServerUrl } from "./server-url";

const getServerUrl = (url: string) => {
  const processEnv = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  if (typeof window === "undefined" && processEnv?.SERVER_URL) {
    return normalizeServerUrl(processEnv.SERVER_URL);
  }

  const normalized = normalizeServerUrl(url);

  if (!normalized) {
    return resolveServerUrl(normalized);
  }

  if (!normalized.startsWith("/")) {
    return normalized;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${normalized}`;
  }

  const vercelUrl =
    processEnv?.VERCEL_ENV === "production"
      ? (processEnv?.VERCEL_PROJECT_PRODUCTION_URL ?? processEnv?.VERCEL_URL)
      : (processEnv?.VERCEL_URL ?? processEnv?.VERCEL_PROJECT_PRODUCTION_URL);
  if (vercelUrl) {
    const origin = vercelUrl.startsWith("http")
      ? vercelUrl
      : `https://${vercelUrl}`;
    return `${origin}${normalized}`;
  }

  return `http://127.0.0.1:3000${normalized}`;
};

export const authClient = createAuthClient({
  // better-auth derives its route-matching base from this URL's path, so the
  // public auth path must equal the server-side mount (/api/auth everywhere)
  baseURL: new URL("/api/auth", getServerUrl(env.VITE_SERVER_URL)).toString(),
  plugins: [
    adminClient(),
    twoFactorClient(),
    passkeyClient(),
    stripeClient({ subscription: true }),
  ],
});
