import { describe, expect, test } from "bun:test";

import {
  communityChatMessageSchema,
  createCommunityRequestSchema,
  moderateCommunityMemberRequestSchema,
} from "@ppal/contracts/community";

describe("community contracts", () => {
  test("accepts a paid creator community and rejects invalid slugs", () => {
    expect(
      createCommunityRequestSchema.parse({
        access: "paid",
        name: "Sharp Picks",
        priceCents: 1500,
        slug: "sharp-picks",
        visibility: "private",
      }).priceCents
    ).toBe(1500);
    expect(() =>
      createCommunityRequestSchema.parse({
        name: "Bad URL",
        slug: "bad_url",
      })
    ).toThrow();
  });

  test("keeps chat payloads bounded and moderation roles safe", () => {
    expect(
      communityChatMessageSchema.parse({
        body: "Good luck @sharpshooter",
        clientId: "client-1",
        type: "message",
      }).body
    ).toContain("@sharpshooter");
    expect(() =>
      communityChatMessageSchema.parse({
        body: "x".repeat(2001),
        clientId: "client-1",
        type: "message",
      })
    ).toThrow();
    expect(() =>
      moderateCommunityMemberRequestSchema.parse({ role: "owner" })
    ).toThrow();
  });
});
