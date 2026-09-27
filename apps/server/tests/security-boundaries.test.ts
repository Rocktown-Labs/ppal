import { describe, expect, test } from "bun:test";

import {
  clearEncryptionKey,
  decryptSync,
  encryptSync,
  setEncryptionKey,
} from "@ppal/db/encryption";

import {
  clearEncryptionKeyCache,
  decryptValue,
  encryptValue,
  setEncryptionKeyValue,
} from "../src/lib/crypto";
import {
  escapeLikePattern,
  safeJsonParse,
  scopeIdempotencyKey,
} from "../src/lib/database";
import { escapeHtml } from "../src/lib/html";
import { hasOperationsAccess } from "../src/lib/operations-auth";
import { matchesDeclaredMimeType } from "../src/lib/upload-security";

const base64UrlEncode = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(
    ""
  );
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const legacyEncryptRawKey = async (
  value: string,
  key: string
): Promise<string> => {
  const bytes = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { iv, name: "AES-GCM" },
    cryptoKey,
    new TextEncoder().encode(value)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return base64UrlEncode(combined);
};

const legacyEncryptSha256Aad = async (
  value: string,
  key: string
): Promise<string> => {
  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key)
  );
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { additionalData: iv, iv, name: "AES-GCM" },
    cryptoKey,
    new TextEncoder().encode(value)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return base64UrlEncode(combined);
};

describe("security boundaries", () => {
  test("operations access fails closed and requires a dedicated bearer", () => {
    const token = "o".repeat(48);
    expect(
      hasOperationsAccess(new Request("https://example.test"), token)
    ).toBe(false);
    expect(
      hasOperationsAccess(
        new Request("https://example.test", {
          headers: { authorization: `Bearer ${token}` },
        }),
        token
      )
    ).toBe(true);
    expect(
      hasOperationsAccess(
        new Request("https://example.test", {
          headers: { authorization: `Bearer ${token}` },
        })
      )
    ).toBe(false);
  });

  test("idempotency keys are namespaced by user", () => {
    expect(scopeIdempotencyKey("user-a", "request-123")).not.toBe(
      scopeIdempotencyKey("user-b", "request-123")
    );
  });

  test("declared upload types must match their magic bytes", () => {
    expect(
      matchesDeclaredMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png"
      )
    ).toBe(true);
    expect(
      matchesDeclaredMimeType(
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
        "image/png"
      )
    ).toBe(false);
  });

  test("html metacharacters are escaped for safe text rendering", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
    );
    expect(escapeHtml("normal text")).toBe("normal text");
  });

  test("database helpers contain malformed JSON and LIKE metacharacters", () => {
    expect(safeJsonParse("not-json", { safe: true })).toEqual({ safe: true });
    expect(escapeLikePattern("50%_off\\today")).toBe("50\\%\\_off\\\\today");
  });

  describe("encryption utilities", () => {
    test("sync AES-GCM round-trips values", () => {
      setEncryptionKey("test-key-".repeat(5));
      const original = "oauth-access-token-123";
      const encrypted = encryptSync(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted.startsWith("enc:")).toBe(true);
      expect(decryptSync(encrypted)).toBe(original);
      clearEncryptionKey();
    });

    test("sync encryption passes through plaintext when no key is set", () => {
      clearEncryptionKey();
      expect(encryptSync("plain")).toBe("plain");
      expect(decryptSync("plain")).toBe("plain");
    });

    test("sync and async encryption utilities are compatible", async () => {
      const key = "shared-test-key-".repeat(2);
      setEncryptionKey(key);
      setEncryptionKeyValue(key);
      const original = "cross-utility-secret";
      const syncEncrypted = encryptSync(original);
      expect(await decryptValue(syncEncrypted)).toBe(original);

      const asyncEncrypted = await encryptValue(original);
      expect(decryptSync(asyncEncrypted)).toBe(original);
      clearEncryptionKey();
      clearEncryptionKeyCache();
    });

    test("decrypting with a missing key throws", () => {
      const key = "missing-key-test-".repeat(2);
      setEncryptionKey(key);
      const encrypted = encryptSync("secret");
      clearEncryptionKey();
      expect(() => decryptSync(encrypted)).toThrow(
        /DATA_ENCRYPTION_KEY is not set/u
      );
    });

    test("async AES-GCM round-trips values", async () => {
      const key = "async-shared-key-value-32-bytes!";
      setEncryptionKeyValue(key);
      const original = "oauth-token-123";
      const encrypted = await encryptValue(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted.startsWith("enc:")).toBe(true);
      expect(await decryptValue(encrypted)).toBe(original);
      clearEncryptionKeyCache();
    });

    test("async decrypt handles legacy raw-key encryption", async () => {
      const key = "legacy-raw-key-value-32-bytes!!!";
      setEncryptionKeyValue(key);
      const original = "legacy-secret";
      const combined = await legacyEncryptRawKey(original, key);
      const encrypted = `enc:${combined}`;
      expect(await decryptValue(encrypted)).toBe(original);
      clearEncryptionKeyCache();
    });

    test("async decrypt handles legacy IV-as-AAD encryption", async () => {
      const key = "legacy-aad-key-value-32-bytes!";
      setEncryptionKeyValue(key);
      const original = "legacy-aad-secret";
      const combined = await legacyEncryptSha256Aad(original, key);
      const encrypted = `enc:${combined}`;
      expect(await decryptValue(encrypted)).toBe(original);
      clearEncryptionKeyCache();
    });
  });
});
