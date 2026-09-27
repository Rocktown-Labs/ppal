/**
 * Escape HTML metacharacters so a string can be safely rendered as text in
 * any client (web React, native Text, etc.). This is a last-line-of-defense
 * measure; clients should still treat community chat bodies as plain text.
 */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
