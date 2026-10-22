import { viewPaths as defaultViewPaths } from "@better-auth-ui/core";

import type { AuthPlugin } from "./auth-plugin";

/**
 * Auth UI plugins registered with the app's `AuthProvider`. A plugin's
 * `viewPaths.auth` entries add routable `/auth/<segment>` views, so the route
 * validator below reads the same list the provider renders.
 */
export const AUTH_UI_PLUGINS: AuthPlugin[] = [];

const authViewPathSegments = new Set<string>([
  ...Object.values(defaultViewPaths.auth),
  ...AUTH_UI_PLUGINS.flatMap((plugin) =>
    Object.values(plugin.viewPaths?.auth ?? {})
  ),
]);

/**
 * Whether `/auth/<segment>` maps to a view the `<Auth>` router can render.
 * An unrecognised segment reaches `<Auth>`, which throws, so the `/auth/$path`
 * route uses this to render a not-found response instead of failing SSR.
 */
export const isAuthViewPath = (segment: string): boolean =>
  authViewPathSegments.has(segment);
