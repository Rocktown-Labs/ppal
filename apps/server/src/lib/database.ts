export const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const escapeLikePattern = (value: string): string =>
  value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

export const scopeIdempotencyKey = (
  userId: string,
  idempotencyKey: string
): string => `${userId}:${idempotencyKey}`;
