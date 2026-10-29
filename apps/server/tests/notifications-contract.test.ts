import { describe, expect, test } from "bun:test";

import {
  notificationPreferencesSchema,
  webPushSubscriptionSchema,
} from "@ppal/contracts/notifications";

import { shouldSendSms } from "../src/services/notifications";

describe("SMS delivery eligibility", () => {
  test("sends SMS only for terminal settlement results", () => {
    for (const type of [
      "ticket.won",
      "ticket.lost",
      "ticket.push",
      "ticket.settled",
      "ticket.partially_void",
      "ticket.void",
    ]) {
      expect(shouldSendSms(type), type).toBe(true);
    }
  });

  test("keeps progress and non-settlement events off SMS", () => {
    for (const type of [
      "ticket.progress",
      "ticket.extracted",
      "community.mention",
      "leg.won",
      "leg.lost",
    ]) {
      expect(shouldSendSms(type), type).toBe(false);
    }
  });
});

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

describe("notification phone destinations", () => {
  const basePreferences = {
    emailEnabled: true,
    inAppEnabled: true,
    legLost: true,
    legWon: true,
    pushEnabled: true,
    smsEnabled: true,
    ticketLost: true,
    ticketWon: true,
  };

  test("accepts an E.164 destination and normalizes a cleared field", () => {
    expect(
      notificationPreferencesSchema.parse({
        ...basePreferences,
        phoneNumber: "+14155550123",
      }).phoneNumber
    ).toBe("+14155550123");
    expect(
      notificationPreferencesSchema.parse({
        ...basePreferences,
        phoneNumber: "",
      }).phoneNumber
    ).toBeNull();
    expect(
      notificationPreferencesSchema.parse({
        ...basePreferences,
        phoneNumber: null,
      }).phoneNumber
    ).toBeNull();
  });

  test("rejects free-form or overlong destinations before they reach the SMS provider", () => {
    expect(() =>
      notificationPreferencesSchema.parse({
        ...basePreferences,
        phoneNumber: "call me at 555",
      })
    ).toThrow();
    expect(() =>
      notificationPreferencesSchema.parse({
        ...basePreferences,
        phoneNumber: `+1${"5".repeat(40)}`,
      })
    ).toThrow();
  });
});
