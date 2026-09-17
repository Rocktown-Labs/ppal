const LOCAL_API_HOST = "127.0.0.1";
const LOCAL_SERVER_URL = `http://${LOCAL_API_HOST}:3000`;
const PRODUCTION_SERVER_URL = "https://api.myparlaypal.com";

const getBrowserFallbackServerUrl = (): string => {
  if (typeof window === "undefined") {
    return PRODUCTION_SERVER_URL;
  }

  const { hostname, origin } = window.location;

  if (hostname === "localhost" || hostname === LOCAL_API_HOST) {
    return LOCAL_SERVER_URL;
  }

  const previewMatch = hostname.match(
    /^pr-(?<previewId>\d+)\.myparlaypal\.com$/iu
  );
  if (previewMatch?.groups?.previewId) {
    return `https://api-pr-${previewMatch.groups.previewId}.myparlaypal.com`;
  }

  if (hostname === "myparlaypal.com" || hostname === "www.myparlaypal.com") {
    return PRODUCTION_SERVER_URL;
  }

  return origin;
};

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

/**
 * Resolve the configured API origin, falling back when a static web build did
 * not receive VITE_SERVER_URL from its deployment environment.
 */
export const resolveServerUrl = (value: string): string => {
  const normalized = normalizeServerUrl(value);
  return normalized || getBrowserFallbackServerUrl();
};
