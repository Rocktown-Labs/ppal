import { describe, expect, test } from "bun:test";

import { webPushSubscriptionSchema } from "@ppal/contracts/notifications";

describe("browser push subscription contract", () => {
  test("accepts a complete HTTPS push subscription", () => {
    expect(
      webPushSubscriptionSchema.parse({
        endpoint: "https://fcm.googleapis.com/fcm/send/example",
        keys: {
          auth: "auth-secret",
          p256dh: "public-key",
        },
      })
    ).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/example",
      keys: {
        auth: "auth-secret",
        p256dh: "public-key",
      },
    });
  });

  test("rejects insecure or incomplete subscriptions", () => {
    expect(() =>
      webPushSubscriptionSchema.parse({
        endpoint: "http://fcm.googleapis.com/fcm/send/example",
        keys: { auth: "auth-secret", p256dh: "public-key" },
      })
    ).toThrow();
    expect(() =>
      webPushSubscriptionSchema.parse({
        endpoint: "https://fcm.googleapis.com/fcm/send/example",
        keys: { auth: "", p256dh: "public-key" },
      })
    ).toThrow();
  });
});
