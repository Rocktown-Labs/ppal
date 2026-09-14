import { describe, expect, test } from "bun:test";

import {
  escapeLikePattern,
  safeJsonParse,
  scopeIdempotencyKey,
} from "../src/lib/database";
import { hasOperationsAccess } from "../src/lib/operations-auth";
import { matchesDeclaredMimeType } from "../src/lib/upload-security";

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

  test("database helpers contain malformed JSON and LIKE metacharacters", () => {
    expect(safeJsonParse("not-json", { safe: true })).toEqual({ safe: true });
    expect(escapeLikePattern("50%_off\\today")).toBe("50\\%\\_off\\\\today");
  });
});
