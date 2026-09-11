import type { Auth } from "@ppal/auth";

export interface AuthUser {
  email: string;
  id: string;
  name: string;
}

interface AuthSession {
  user: AuthUser;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getSessionFromHandler = async (
  auth: Auth,
  headers: Headers
): Promise<AuthSession | null> => {
  const host = headers.get("host");
  if (!headers.get("cookie")) {
    return null;
  }

  const forwardedProtocol = headers.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" ||
    (host && /^(?:localhost|127\.)/iu.test(host))
      ? "http"
      : "https";
  const configuredBaseUrl = auth.options.baseURL;
  let origin: string | null = null;
  if (host) {
    origin = `${protocol}://${host}`;
  } else if (typeof configuredBaseUrl === "string") {
    origin = configuredBaseUrl.replace(/\/$/u, "");
  }
  if (!origin) {
    return null;
  }
  const request = new Request(`${origin}/api/auth/get-session`, {
    headers: new Headers(headers),
    method: "GET",
  });
  const payload = (await auth.api.getSession({
    headers: request.headers,
    request,
  })) as AuthSession | null;
  if (payload && isRecord(payload.user)) {
    const { email, id, name } = payload.user;
    if (
      typeof email === "string" &&
      typeof id === "string" &&
      typeof name === "string"
    ) {
      return { user: { email, id, name } };
    }
  }

  // Cloudflare's request adapter can lose the per-request auth context on a
  // direct API call. The same handler over the worker origin remains the
  // authoritative fallback and preserves Better Auth's cookie validation.
  const response = await fetch(request.clone());
  if (!response.ok) {
    return null;
  }
  const responsePayload: unknown = await response.json();
  if (!isRecord(responsePayload) || !isRecord(responsePayload.user)) {
    return null;
  }
  const { email, id, name } = responsePayload.user;
  if (
    typeof email !== "string" ||
    typeof id !== "string" ||
    typeof name !== "string"
  ) {
    return null;
  }
  return { user: { email, id, name } };
};

export const getAuthUser = async (
  auth: Auth,
  headers: Headers
): Promise<AuthUser | null> => {
  try {
    const handlerSession = await getSessionFromHandler(auth, headers);
    if (handlerSession) {
      return handlerSession.user;
    }
  } catch {
    // Fall through to the direct API helper for non-HTTP test adapters.
  }

  const session = (await auth.api.getSession({
    headers: new Headers(headers),
  })) as AuthSession | null;
  return session?.user ?? null;
};
