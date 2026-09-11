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
  if (!host || !headers.get("cookie")) {
    return null;
  }

  const forwardedProtocol = headers.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || /^(?:localhost|127\.)/iu.test(host)
      ? "http"
      : "https";
  const request = new Request(`${protocol}://${host}/api/auth/get-session`, {
    headers: new Headers(headers),
    method: "GET",
  });
  const response = await auth.handler(request);
  if (!response.ok) {
    return null;
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.user)) {
    return null;
  }
  const { email, id, name } = payload.user;
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
