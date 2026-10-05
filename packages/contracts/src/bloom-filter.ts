/* oxlint-disable no-bitwise, no-plusplus */
/**
 * Space-efficient Bloom Filter for rapid client-side and server-side
 * username reservation checking.
 */
export class BloomFilter {
  private size: number;
  private hashCount: number;
  private bitArray: Uint8Array;

  constructor(size = 1024, hashCount = 4) {
    this.size = size;
    this.hashCount = hashCount;
    this.bitArray = new Uint8Array(Math.ceil(size / 8));
  }

  private hash(str: string, seed: number): number {
    let hash = 2_166_136_261 ^ seed;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.codePointAt(i) ?? 0;
      hash = Math.imul(hash, 16_777_619);
    }
    return Math.abs(hash) % this.size;
  }

  public add(item: string): void {
    const normalized = item.trim().toLowerCase();
    for (let i = 0; i < this.hashCount; i++) {
      const bitIndex = this.hash(normalized, i * 31 + 17);
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      const currentByte = this.bitArray[byteIndex] ?? 0;
      this.bitArray[byteIndex] = currentByte | (1 << bitOffset);
    }
  }

  public has(item: string): boolean {
    const normalized = item.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    for (let i = 0; i < this.hashCount; i++) {
      const bitIndex = this.hash(normalized, i * 31 + 17);
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      const currentByte = this.bitArray[byteIndex] ?? 0;
      if ((currentByte & (1 << bitOffset)) === 0) {
        return false;
      }
    }
    return true;
  }
}

export const RESERVED_USERNAMES = [
  "parlaypal",
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "security",
  "official",
  "moderator",
  "mod",
  "parlay",
  "bettor",
  "sportsbook",
  "staff",
  "api",
  "null",
  "undefined",
  "explore",
  "dashboard",
  "billing",
  "settings",
  "verified",
] as const;

export const usernameBloomFilter = new BloomFilter(2048, 5);
for (const name of RESERVED_USERNAMES) {
  usernameBloomFilter.add(name);
}

export interface UsernameValidationResult {
  available: boolean;
  reason?: string;
}

export const validateUsernameWithBloomFilter = (
  username: string
): UsernameValidationResult => {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) {
    return { available: false, reason: "Username is required." };
  }

  if (trimmed.length < 3 || trimmed.length > 30) {
    return {
      available: false,
      reason: "Username must be between 3 and 30 characters.",
    };
  }

  if (!/^[a-z0-9_]+$/iu.test(trimmed)) {
    return {
      available: false,
      reason: "Username can only contain letters, numbers, and underscores.",
    };
  }

  if (usernameBloomFilter.has(trimmed)) {
    return {
      available: false,
      reason: `Username '@${trimmed}' is reserved. Choose another handle.`,
    };
  }

  return { available: true };
};
