import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Synchronous encryption helpers for sensitive database columns managed by
 * Better Auth. These run inside Cloudflare Workers via the `nodejs_compat`
 * flag and produce the same `enc:<base64url>` format as the async helpers in
 * `apps/server/src/lib/crypto.ts`.
 *
 * The encryption key is set once by `@ppal/auth` during initialization. If no
 * key is set, values pass through unchanged (safe for tests/local dev).
 */

const ENCRYPTED_PREFIX = "enc:";

let rawKey: string | undefined;

const base64UrlEncode = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(
    ""
  );
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const base64UrlDecode = (value: string): Uint8Array => {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.codePointAt(index) ?? 0;
  }
  return bytes;
};

const deriveKeyBytes = (raw: string): Buffer => {
  const input = raw.startsWith("0x")
    ? Buffer.from(raw.slice(2), "hex")
    : Buffer.from(raw);
  if (input.length < 16) {
    throw new Error("DATA_ENCRYPTION_KEY must be at least 16 bytes");
  }
  // Derive a 32-byte key deterministically so any sufficiently long secret works.
  return createHash("sha256").update(input).digest();
};

let keyBytes: Buffer | null | undefined;

const encryptionKey = (): Buffer | null => {
  if (keyBytes === undefined) {
    keyBytes = rawKey ? deriveKeyBytes(rawKey) : null;
  }
  return keyBytes;
};

export const setEncryptionKey = (value: string): void => {
  rawKey = value.trim();
  keyBytes = undefined;
};

export const hasEncryptionKey = (): boolean => Boolean(encryptionKey());

export const encryptSync = (value: string): string => {
  if (!value) {
    return value;
  }
  const key = encryptionKey();
  if (!key) {
    return value;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, tag]);
  return `${ENCRYPTED_PREFIX}${base64UrlEncode(combined)}`;
};

export const decryptSync = (value: string): string => {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }
  const key = encryptionKey();
  if (!key) {
    throw new Error("Encrypted value found but DATA_ENCRYPTION_KEY is not set");
  }
  const combined = Buffer.from(
    base64UrlDecode(value.slice(ENCRYPTED_PREFIX.length))
  );
  if (combined.length < 28) {
    throw new Error("Invalid encrypted value");
  }
  const iv = combined.slice(0, 12);
  const tag = combined.slice(-16);
  const ciphertext = combined.slice(12, -16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf-8");
};

export const clearEncryptionKey = (): void => {
  rawKey = undefined;
  keyBytes = undefined;
};
