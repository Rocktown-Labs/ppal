const LOCAL_API_HOST = "127.0.0.1";

/**
 * Resolve the API origin used by browser-side clients.
 *
 * Wrangler binds the local Worker to IPv4 loopback. Browsers may resolve
 * `localhost` to IPv6 first, which can route requests to an unrelated process
 * when another local app is listening on the same port. Keep production URLs
 * unchanged and normalize only the local Vite development target.
 */
export const normalizeServerUrl = (value: string): string => {
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  if (!import.meta.env.DEV || normalized.startsWith("/")) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    if (
      url.protocol === "http:" &&
      url.hostname === "localhost" &&
      url.port === "3000"
    ) {
      url.hostname = LOCAL_API_HOST;
      return url.toString().replace(/\/$/u, "");
    }
  } catch {
    // Keep the original value so the configured environment error remains
    // visible to the caller instead of masking it with a second error.
  }

  return normalized;
};
