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

const createSessionRequest = (
  auth: Auth,
  input: Headers | Request
): Request | null => {
  const headers = input instanceof Request ? input.headers : input;
  if (!headers.get("cookie")) {
    return null;
  }
  if (input instanceof Request) {
    const url = new URL(input.url);
    url.pathname = "/api/auth/get-session";
    url.search = "";
    return new Request(url, input);
  }

  const host = headers.get("host");
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
  return new Request(`${origin}/api/auth/get-session`, {
    headers: new Headers(headers),
    method: "GET",
  });
};

const getSessionFromHandler = async (
  auth: Auth,
  input: Headers | Request
): Promise<AuthSession | null> => {
  const request = createSessionRequest(auth, input);
  if (!request) {
    return null;
  }
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
  const response = await fetch(request.url, {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
      origin: request.headers.get("origin") ?? new URL(request.url).origin,
    },
    method: "GET",
  });
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

export const getAuthDiagnostics = async (
  auth: Auth,
  request: Request
): Promise<Record<string, unknown>> => {
  const sessionRequest = createSessionRequest(auth, request);
  if (!sessionRequest) {
    return {
      cookie: false,
      host: request.headers.get("host"),
      requestUrl: request.url,
    };
  }
  let direct = "null";
  let directError: string | null = null;
  try {
    const result = await auth.api.getSession({
      headers: sessionRequest.headers,
      request: sessionRequest,
    });
    direct = result ? "session" : "null";
  } catch (error) {
    directError = error instanceof Error ? error.message : "unknown";
  }
  let handlerStatus: number | null = null;
  let handlerBody = "unknown";
  try {
    const response = await auth.handler(sessionRequest.clone());
    handlerStatus = response.status;
    const payload: unknown = await response.json();
    handlerBody =
      isRecord(payload) && isRecord(payload.user) ? "session" : "null";
  } catch (error) {
    handlerBody = error instanceof Error ? error.message : "unknown";
  }
  return {
    cookie: true,
    direct,
    directError,
    handlerBody,
    handlerStatus,
    host: request.headers.get("host"),
    requestUrl: sessionRequest.url,
  };
};

export const getAuthUser = async (
  auth: Auth,
  input: Headers | Request
): Promise<AuthUser | null> => {
  try {
    const handlerSession = await getSessionFromHandler(auth, input);
    if (handlerSession) {
      return handlerSession.user;
    }
  } catch {
    // Fall through to the direct API helper for non-HTTP test adapters.
  }

  const session = (await auth.api.getSession({
    headers: new Headers(input instanceof Request ? input.headers : input),
  })) as AuthSession | null;
  return session?.user ?? null;
};
