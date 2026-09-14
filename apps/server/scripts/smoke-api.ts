const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3000";

const verifyJson = async (
  path: string,
  validate: (payload: unknown) => boolean
): Promise<void> => {
  const response = await fetch(new URL(path, apiBaseUrl));
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as unknown;
  if (!validate(payload)) {
    throw new Error(`${path} returned an invalid response contract`);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

await verifyJson(
  "/health",
  (payload) => isRecord(payload) && payload.status === "ok"
);
await verifyJson(
  "/api/v1/ping",
  (payload) => isRecord(payload) && payload.ok === true
);
console.info(`API smoke checks passed at ${apiBaseUrl}`);
