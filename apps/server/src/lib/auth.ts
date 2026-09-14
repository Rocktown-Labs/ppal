import type { Auth } from "@ppal/auth";

export interface AuthUser {
  email: string;
  id: string;
  name: string;
}

interface AuthSession {
  user: AuthUser;
}

export interface AuthUserOptions {
  /** Bypass Better Auth's short-lived signed cookie snapshot. */
  authoritative?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getConfiguredOrigin = (auth: Auth): string | null => {
  const configuredBaseUrl = auth.options.baseURL;
  if (typeof configuredBaseUrl !== "string" || !configuredBaseUrl.trim()) {
    return null;
  }
  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    return null;
  }
};

const createSessionRequest = (
  auth: Auth,
  input: Headers | Request
): Request | null => {
  const headers = input instanceof Request ? input.headers : input;
  if (!headers.get("cookie")) {
    return null;
  }

  // Prefer the configured Better Auth origin. Host is request input and must
  // not be allowed to redirect a session-bearing fallback to an attacker.
  let origin = getConfiguredOrigin(auth);
  if (!origin) {
    const host = headers.get("host");
    const isLocalHost = Boolean(
      host && /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/iu.test(host)
    );
    if (isLocalHost) {
      const protocol =
        headers.get("x-forwarded-proto") === "https" ? "https" : "http";
      origin = `${protocol}://${host}`;
    }
  }
  if (!origin) {
    return null;
  }

  const url = new URL("/api/auth/get-session", origin);
  // Session lookup is a GET and never needs the caller's body. Constructing a
  // fresh request also keeps this safe after a validator has consumed it.
  return new Request(url, {
    headers: new Headers(headers),
    method: "GET",
  });
};

const getSessionFromHandler = async (
  auth: Auth,
  input: Headers | Request,
  options: AuthUserOptions
): Promise<AuthSession | null> => {
  const request = createSessionRequest(auth, input);
  if (!request) {
    return null;
  }
  const query = options.authoritative
    ? { disableCookieCache: true }
    : undefined;
  const payload = (await auth.api.getSession({
    headers: request.headers,
    ...(query ? { query } : {}),
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
  // direct API call. Re-run Better Auth's handler in-process so the fallback
  // preserves cookie validation without a billed self-subrequest.
  const handlerUrl = new URL(request.url);
  if (options.authoritative) {
    handlerUrl.searchParams.set("disableCookieCache", "true");
  }
  const handlerRequest = new Request(handlerUrl, {
    headers: new Headers(request.headers),
    method: "GET",
  });
  const response = await auth.handler(handlerRequest);
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
  input: Headers | Request,
  options: AuthUserOptions = {}
): Promise<AuthUser | null> => {
  const headers = new Headers(input instanceof Request ? input.headers : input);
  const query = options.authoritative
    ? { disableCookieCache: true }
    : undefined;
  try {
    const session = (await auth.api.getSession({
      headers,
      ...(query ? { query } : {}),
    })) as AuthSession | null;
    if (session?.user && isRecord(session.user)) {
      const { email, id, name } = session.user;
      if (
        typeof email === "string" &&
        typeof id === "string" &&
        typeof name === "string"
      ) {
        return { email, id, name };
      }
    }
  } catch {
    // Fall through to the request-aware handler for non-HTTP test adapters.
  }

  try {
    const handlerSession = await getSessionFromHandler(auth, input, options);
    return handlerSession?.user ?? null;
  } catch {
    return null;
  }
};
