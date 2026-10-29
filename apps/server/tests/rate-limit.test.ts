import { describe, expect, test } from "bun:test";

import { getRateLimitKey } from "../src/lib/rate-limit";

const requestWith = (headers: Record<string, string>): Request =>
  new Request("https://example.test/api/v1/ping", { headers });

describe("rate limit keys", () => {
  test("client-controlled cookie rotation cannot create new buckets", async () => {
    const first = await getRateLimitKey(
      requestWith({
        "cf-connecting-ip": "203.0.113.10",
        cookie: "session=one",
      })
    );
    const second = await getRateLimitKey(
      requestWith({
        "cf-connecting-ip": "203.0.113.10",
        cookie: "session=two",
      })
    );

    expect(first).toBe(second);
  });

  test("client-controlled authorization rotation cannot create new buckets", async () => {
    const first = await getRateLimitKey(
      requestWith({
        authorization: "Bearer one",
        "cf-connecting-ip": "203.0.113.11",
      })
    );
    const second = await getRateLimitKey(
      requestWith({
        authorization: "Bearer two",
        "cf-connecting-ip": "203.0.113.11",
      })
    );

    expect(first).toBe(second);
  });

  test("different edge addresses keep separate buckets", async () => {
    const first = await getRateLimitKey(
      requestWith({ "cf-connecting-ip": "203.0.113.12" })
    );
    const second = await getRateLimitKey(
      requestWith({ "cf-connecting-ip": "203.0.113.13" })
    );

    expect(first).not.toBe(second);
  });
});
