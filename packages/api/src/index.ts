import { hc } from "hono/client";
import type { ApplyGlobalResponse, ClientRequestOptions } from "hono/client";
import type { AppType } from "server/src/index";

/**
 * Error payload emitted by the global middleware registered in
 * `apps/server/src/index.ts`: the cross-site origin guard (403), the rate
 * limiters (429), `app.notFound` (404) and `app.onError` (500). Per-route
 * handlers return the same contract, but global middleware responses are
 * invisible to RPC inference, so they are folded in with
 * `ApplyGlobalResponse` below.
 */
interface ApiError {
  code: string;
  error: string;
}

/**
 * The server's route tree plus the global error responses. `hc` returns
 * unioned per-status response types, so clients can switch on `res.status`
 * and exhaustively handle the global 403/429/404/500 shapes.
 */
export type ApiApp = ApplyGlobalResponse<
  AppType,
  {
    403: { json: ApiError };
    404: { json: ApiError };
    429: { json: ApiError };
    500: { json: ApiError };
  }
>;

// Instantiate the client once here so the heavy generic expansion is cached
// in this package instead of being recomputed on every keystroke inside the
// consuming apps (see https://hono.dev/docs/guides/rpc#compile-your-code-before-using-it).
const client = hc<ApiApp>("http://ppal.internal");
export type AppClient = typeof client;

export type { InferRequestType, InferResponseType } from "hono/client";
export type { AppType } from "server/src/index";

/**
 * Create a typed Hono RPC client. Options accept a custom `fetch` (used by
 * native to attach the better-auth cookie jar) and `init`/`headers` (used by
 * web to send session cookies).
 */
export const createClient = (
  baseUrl: string,
  options?: ClientRequestOptions
): AppClient => hc<ApiApp>(baseUrl, options);
