import { describe, expect, test } from "bun:test";

import {
  assertPlan,
  EntitlementError,
  getUserPlan,
  hasPlan,
} from "../src/lib/entitlements";

const mockDb = (row: unknown): D1Database => {
  const prepared = {
    bind: () => prepared,
    first: () => Promise.resolve(row),
  } as unknown as D1PreparedStatement;
  return {
    prepare: () => prepared,
  } as unknown as D1Database;
};

describe("entitlements", () => {
  test("users without an entitlement row are free", async () => {
    expect(await getUserPlan(mockDb(null), "user-1")).toBe("free");
  });

  test("active pro users resolve to pro", async () => {
    const future = Date.now() + 86_400_000;
    const db = mockDb({
      expires_at: future,
      plan: "pro",
      status: "active",
    });
    expect(await getUserPlan(db, "user-1")).toBe("pro");
  });

  test("expired pro users fall back to free", async () => {
    const past = Date.now() - 86_400_000;
    const db = mockDb({
      expires_at: past,
      plan: "pro",
      status: "active",
    });
    expect(await getUserPlan(db, "user-1")).toBe("free");
  });

  test("cancelled pro users fall back to free", async () => {
    const future = Date.now() + 86_400_000;
    const db = mockDb({
      expires_at: future,
      plan: "pro",
      status: "cancelled",
    });
    expect(await getUserPlan(db, "user-1")).toBe("free");
  });

  test("creator outranks pro", async () => {
    const future = Date.now() + 86_400_000;
    const db = mockDb({
      expires_at: future,
      plan: "creator",
      status: "active",
    });
    expect(await hasPlan(db, "user-1", "pro")).toBe(true);
    expect(await hasPlan(db, "user-1", "creator")).toBe(true);
  });

  test("assertPlan throws EntitlementError when plan is too low", async () => {
    const db = mockDb(null);
    await expect(assertPlan(db, "user-1", "pro")).rejects.toThrow(
      EntitlementError
    );
    try {
      await assertPlan(db, "user-1", "pro");
    } catch (error) {
      expect(error).toBeInstanceOf(EntitlementError);
      expect((error as EntitlementError).actualPlan).toBe("free");
      expect((error as EntitlementError).requiredPlan).toBe("pro");
    }
  });

  test("assertPlan succeeds when plan meets the minimum", async () => {
    const future = Date.now() + 86_400_000;
    const db = mockDb({
      expires_at: future,
      plan: "pro",
      status: "active",
    });
    await expect(assertPlan(db, "user-1", "pro")).resolves.toBeUndefined();
  });
});
