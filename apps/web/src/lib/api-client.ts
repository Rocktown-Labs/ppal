import { createClient } from "@ppal/api";
import { env } from "@ppal/env/web";

import { resolveServerUrl } from "./server-url";

export const API_BASE_URL = resolveServerUrl(env.VITE_SERVER_URL);

/**
 * Typed Hono RPC client. Every request and response shape is inferred from
 * the server's exported `AppType`, so route and schema changes surface as
 * compile errors here instead of failing silently at runtime. Session
 * cookies are attached via `credentials: "include"` for better-auth.
 */
export const client = createClient(API_BASE_URL, {
  init: { credentials: "include" },
});
