import { createMiddleware } from "@tanstack/react-start";

import { authClient } from "@/lib/auth-client";

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    let session = null;
    try {
      session = await authClient.getSession({
        fetchOptions: {
          headers: request.headers,
          throw: true,
        },
      });
    } catch {
      session = null;
    }
    return next({
      context: { session },
    });
  }
);
