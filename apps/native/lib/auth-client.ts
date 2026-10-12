import { expoClient } from "@better-auth/expo/client";
import { env } from "@ppal/env/native";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const scheme = (Constants.expoConfig?.scheme as string | undefined) ?? "ppal";

export const authClient = createAuthClient({
  baseURL: env.EXPO_PUBLIC_SERVER_URL,
  fetchOptions: {
    onRequest(context) {
      // In Expo Go or development clients, Linking.createURL defaults to "exp://...",
      // which fails server origin validation when targeting remote/production APIs.
      // Explicitly set the registered app scheme ("ppal://") so Better Auth accepts native requests.
      const appSchemeOrigin = `${scheme}://`;
      if (context.headers instanceof Headers) {
        context.headers.set("expo-origin", appSchemeOrigin);
        const origin = context.headers.get("origin");
        if (
          origin &&
          (origin.startsWith("exp://") ||
            origin.startsWith("http://localhost") ||
            origin.startsWith("http://127.0.0.1"))
        ) {
          context.headers.set("origin", "https://myparlaypal.com");
        }
      } else if (context.headers && typeof context.headers === "object") {
        const headers = context.headers as Record<string, string>;
        headers["expo-origin"] = appSchemeOrigin;
        const origin = headers.origin;
        if (
          origin &&
          (origin.startsWith("exp://") ||
            origin.startsWith("http://localhost") ||
            origin.startsWith("http://127.0.0.1"))
        ) {
          headers.origin = "https://myparlaypal.com";
        }
      }
    },
  },
  plugins: [
    expoClient({
      scheme,
      storage: SecureStore,
      storagePrefix: scheme,
    }),
  ],
});
