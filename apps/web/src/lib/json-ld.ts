const JSON_LD_ESCAPES: Record<string, string> = {
  "&": "\\u0026",
  "<": "\\u003c",
  ">": "\\u003e",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/**
 * Serialize a JSON-LD document for embedding inside a `<script>` element.
 *
 * `JSON.stringify` does not escape `<`, so a user-controlled value containing
 * `</script>` can terminate the element and inject markup into the page. These
 * escapes keep the payload valid JSON while making it inert inside HTML.
 */
export const serializeJsonLd = (value: unknown): string =>
  JSON.stringify(value).replaceAll(
    /[<>&\u2028\u2029]/gu,
    (character) => JSON_LD_ESCAPES[character] ?? character
  );
