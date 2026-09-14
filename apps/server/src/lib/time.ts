export const toIsoString = (value: number | null): string | null =>
  value === null ? null : new Date(value).toISOString();
