/**
 * Application-layer encryption helpers for sensitive data stored in D1.
 *
 * The implementation uses AES-256-GCM with a random 12-byte IV. The encrypted
 * payload format is compact and includes the IV and authentication tag:
 *
 *   enc:<base64url(iv + ciphertext + tag)>
 *
 * If `DATA_ENCRYPTION_KEY` is not configured, the helpers pass values through
 * unchanged. This keeps local/test environments simple, but production must set
 * the key.
 *
 * Backward compatibility:
 * - Older code used the raw key bytes directly; decryption falls back to that.
 * - A previous iteration also included the IV as additional authenticated data;
 *   decryption falls back to that as well.
 */

const ENCRYPTED_PREFIX = "enc:";

const hexToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const base64UrlEncode = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(
    ""
  );
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const base64UrlDecode = (value: string): Uint8Array<ArrayBuffer> => {
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

const loadRawKey = async (): Promise<string | undefined> => {
  try {
    const { env } = await import("@ppal/env/server");
    return env.DATA_ENCRYPTION_KEY?.trim();
  } catch {
    return undefined;
  }
};

let overrideRawKey: string | undefined;
let cachedSha256Key: CryptoKey | null | undefined;
let cachedRawKey: CryptoKey | null | undefined;

export const clearEncryptionKeyCache = (): void => {
  cachedSha256Key = undefined;
  cachedRawKey = undefined;
};

export const setEncryptionKeyValue = (raw: string): void => {
  overrideRawKey = raw.trim();
  clearEncryptionKeyCache();
};

const getRawKey = async (): Promise<string | undefined> =>
  overrideRawKey ?? (await loadRawKey());

const importEncryptionKey = async ({
  algorithm,
  raw,
}: {
  algorithm: "raw" | "sha256";
  raw?: string;
}): Promise<CryptoKey | null> => {
  if (!raw) {
    return null;
  }
  const bytes = new Uint8Array(
    raw.startsWith("0x")
      ? hexToBytes(raw.slice(2))
      : new TextEncoder().encode(raw)
  );
  if (bytes.length < 16) {
    throw new Error("DATA_ENCRYPTION_KEY must be at least 16 bytes");
  }
  const keyBytes =
    algorithm === "sha256"
      ? new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
      : bytes;
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
};

const sha256EncryptionKey = async (): Promise<CryptoKey | null> => {
  if (cachedSha256Key === undefined) {
    const raw = await getRawKey();
    try {
      cachedSha256Key = await importEncryptionKey({ algorithm: "sha256", raw });
    } catch {
      cachedSha256Key = null;
    }
  }
  return cachedSha256Key;
};

const rawEncryptionKey = async (): Promise<CryptoKey | null> => {
  if (cachedRawKey === undefined) {
    const raw = await getRawKey();
    try {
      cachedRawKey = await importEncryptionKey({ algorithm: "raw", raw });
    } catch {
      cachedRawKey = null;
    }
  }
  return cachedRawKey;
};

const tryDecrypt = async (
  key: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
  ciphertext: Uint8Array<ArrayBuffer>,
  additionalData?: Uint8Array<ArrayBuffer>
): Promise<string> => {
  const decrypted = await crypto.subtle.decrypt(
    { additionalData, iv, name: "AES-GCM" },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
};

export const encryptValue = async (value: string): Promise<string> => {
  if (!value) {
    return value;
  }
  const key = await sha256EncryptionKey();
  if (!key) {
    return value;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { iv, name: "AES-GCM" },
    key,
    new TextEncoder().encode(value)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return `${ENCRYPTED_PREFIX}${base64UrlEncode(combined)}`;
};

export const decryptValue = async (value: string): Promise<string> => {
  if (!value || !value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }
  const sha256Key = await sha256EncryptionKey();
  if (!sha256Key) {
    throw new Error("Encrypted value found but DATA_ENCRYPTION_KEY is not set");
  }
  const rawKey = await rawEncryptionKey();
  const combined = base64UrlDecode(value.slice(ENCRYPTED_PREFIX.length));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Modern format: SHA-256 derived key, no additional data.
  try {
    return await tryDecrypt(sha256Key, iv, ciphertext);
  } catch {
    // Try the legacy format used by earlier code: SHA-256 key with IV as AAD.
    try {
      return await tryDecrypt(sha256Key, iv, ciphertext, iv);
    } catch {
      // Legacy format: raw key bytes, no additional data.
      if (!rawKey) {
        throw new Error("Encrypted value could not be decrypted");
      }
      return tryDecrypt(rawKey, iv, ciphertext);
    }
  }
  /* c8 ignore next */
};

export const hashValue = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
};
