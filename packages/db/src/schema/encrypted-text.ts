import { customType } from "drizzle-orm/sqlite-core";

import { decryptSync, encryptSync } from "../encryption";

/**
 * A SQLite text column that is transparently encrypted when written and
 * decrypted when read. Use this for long-lived secrets managed by Better Auth
 * such as OAuth tokens and two-factor credentials.
 *
 * If no encryption key is configured, values pass through unchanged so tests
 * and local development keep working.
 */
export const encryptedText = (name: string) =>
  customType<{ data: string; driverParam: string }>({
    dataType: () => "text",
    fromDriver: (value: unknown) =>
      typeof value === "string" ? decryptSync(value) : "",
    toDriver: (value: string) => encryptSync(value),
  })(name);

/**
 * Optional-nullable variant of `encryptedText`.
 */
export const encryptedTextNullable = (name: string) =>
  customType<{ data: string | null; driverParam: string | null }>({
    dataType: () => "text",
    fromDriver: (value: unknown) =>
      typeof value === "string" ? decryptSync(value) : null,
    toDriver: (value: string | null) =>
      value === null ? null : encryptSync(value),
  })(name);
