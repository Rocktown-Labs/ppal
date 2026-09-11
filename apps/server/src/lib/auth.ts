import type { Auth } from "@ppal/auth";

export interface AuthUser {
  email: string;
  id: string;
  name: string;
}

interface AuthSession {
  user: AuthUser;
}

export const getAuthUser = async (
  auth: Auth,
  headers: Headers
): Promise<AuthUser | null> => {
  const session = (await auth.api.getSession({
    headers,
  })) as AuthSession | null;
  return session?.user ?? null;
};
