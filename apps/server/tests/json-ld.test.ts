import { describe, expect, test } from "bun:test";

import { serializeJsonLd } from "../../web/src/lib/json-ld";

describe("JSON-LD serialization", () => {
  test("cannot terminate the script element from user content", () => {
    const serialized = serializeJsonLd({
      description: "</script><script>alert(1)</script>",
      name: "A & B",
    });

    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script>");
    expect(JSON.parse(serialized)).toEqual({
      description: "</script><script>alert(1)</script>",
      name: "A & B",
    });
  });

  test("escapes JavaScript line separators", () => {
    const serialized = serializeJsonLd({ text: "a\u2028b\u2029c" });

    expect(serialized).not.toContain("\u2028");
    expect(serialized).not.toContain("\u2029");
    expect(JSON.parse(serialized)).toEqual({ text: "a\u2028b\u2029c" });
  });
});
