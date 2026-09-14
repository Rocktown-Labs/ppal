const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,16}$/u;
const REFERRAL_INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "ppal_referral_intent";

interface ReferralIntent {
  code: string;
  expiresAt: number;
}

export const saveReferralIntent = (code: string): boolean => {
  const normalizedCode = code.trim().toUpperCase();
  if (!REFERRAL_CODE_PATTERN.test(normalizedCode)) {
    return false;
  }
  const intent: ReferralIntent = {
    code: normalizedCode,
    expiresAt: Date.now() + REFERRAL_INTENT_TTL_MS,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  return true;
};

export const consumeReferralIntent = (): string | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const intent = JSON.parse(raw) as Partial<ReferralIntent>;
    if (
      typeof intent.code !== "string" ||
      typeof intent.expiresAt !== "number" ||
      intent.expiresAt < Date.now() ||
      !REFERRAL_CODE_PATTERN.test(intent.code)
    ) {
      return null;
    }
    return intent.code;
  } catch {
    return null;
  }
};

export const clearReferralIntent = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};
