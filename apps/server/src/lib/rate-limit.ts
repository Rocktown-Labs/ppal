/**
 * Rate-limit bucket key for API and auth requests.
 *
 * The key must be derived from facts the client cannot choose per request.
 * `cf-connecting-ip` is written by Cloudflare at the edge; cookies and
 * authorization headers are supplied by the caller and therefore are not a
 * safe bucket identity before the request has been authenticated.
 */
export const getRateLimitKey = (request: Request): string =>
  request.headers.get("cf-connecting-ip") ?? "local";
