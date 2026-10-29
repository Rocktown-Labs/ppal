import { describe, expect, test } from "bun:test";

import {
  canActivatePaidMembership,
  canLeaveCommunity,
  canReadCommunityContent,
  canViewCommunity,
} from "../src/lib/community-access";

const publicFree = { access: "free", visibility: "public" } as const;
const publicPaid = { access: "paid", visibility: "public" } as const;
const privateFree = { access: "free", visibility: "private" } as const;
const active = { status: "active" } as const;
const pending = { status: "pending" } as const;
const muted = { status: "muted" } as const;
const banned = { status: "banned" } as const;

describe("community access", () => {
  test("public free communities stay readable without a session", () => {
    expect(canViewCommunity(publicFree, null)).toBe(true);
    expect(canReadCommunityContent(publicFree, null)).toBe(true);
  });

  test("paid community content requires an active membership even when public", () => {
    expect(canViewCommunity(publicPaid, null)).toBe(true);
    expect(canReadCommunityContent(publicPaid, null)).toBe(false);
    expect(canReadCommunityContent(publicPaid, active)).toBe(true);
  });

  test("private community content requires an active membership", () => {
    expect(canViewCommunity(privateFree, null)).toBe(false);
    expect(canReadCommunityContent(privateFree, null)).toBe(false);
    expect(canReadCommunityContent(privateFree, pending)).toBe(false);
    expect(canReadCommunityContent(privateFree, active)).toBe(true);
  });

  test("moderated members cannot erase their status by leaving", () => {
    expect(canLeaveCommunity(active)).toBe(true);
    expect(canLeaveCommunity(pending)).toBe(true);
    expect(canLeaveCommunity(muted)).toBe(false);
    expect(canLeaveCommunity(banned)).toBe(false);
  });

  test("moderated members cannot reactivate a stored paid checkout", () => {
    expect(canActivatePaidMembership(null)).toBe(true);
    expect(canActivatePaidMembership(pending)).toBe(true);
    expect(canActivatePaidMembership(active)).toBe(true);
    expect(canActivatePaidMembership(muted)).toBe(false);
    expect(canActivatePaidMembership(banned)).toBe(false);
  });
});
