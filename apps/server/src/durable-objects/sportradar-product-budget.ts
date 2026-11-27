import { DurableObject } from "cloudflare:workers";

interface ProductBudgetState {
  lastRequestAt: number | null;
  providerRemaining: number | null;
  providerResetAt: number | null;
  requestTimestamps: number[];
}

export interface ProductBudgetRequest {
  qps: number;
  rollingQuota: number;
  rollingWindowMs: number;
}

export interface ProductBudgetDecision {
  granted: boolean;
  remaining: number;
  retryAfterMs: number;
}

const STATE_KEY = "budget";

/**
 * Serializes upstream SportsAPI Pro calls across all queue consumers and
 * enforces both QPS pacing and the shared daily account quota (including
 * authoritative `X-RateLimit-Remaining` / `X-RateLimit-Reset` headers).
 */
export class SportradarProductBudget extends DurableObject {
  async acquire({
    qps,
    rollingQuota,
    rollingWindowMs,
  }: ProductBudgetRequest): Promise<ProductBudgetDecision> {
    const now = Date.now();
    const state = (await this.ctx.storage.get<ProductBudgetState>(
      STATE_KEY
    )) ?? {
      lastRequestAt: null,
      providerRemaining: null,
      providerResetAt: null,
      requestTimestamps: [],
    };
    const providerResetActive =
      state.providerResetAt !== null && state.providerResetAt > now;
    const providerRemaining = providerResetActive
      ? state.providerRemaining
      : null;

    if (providerRemaining !== null && providerRemaining <= 0) {
      return {
        granted: false,
        remaining: 0,
        retryAfterMs: Math.max((state.providerResetAt ?? now) - now, 60_000),
      };
    }

    const windowStart = now - rollingWindowMs;
    const requestTimestamps = state.requestTimestamps.filter(
      (timestamp) => timestamp > windowStart
    );
    if (requestTimestamps.length >= rollingQuota) {
      const oldest = requestTimestamps[0] ?? now;
      await this.ctx.storage.put(STATE_KEY, {
        lastRequestAt: state.lastRequestAt,
        providerRemaining,
        providerResetAt: providerResetActive ? state.providerResetAt : null,
        requestTimestamps,
      } satisfies ProductBudgetState);
      return {
        granted: false,
        remaining: 0,
        retryAfterMs: Math.max(oldest + rollingWindowMs - now, 1000),
      };
    }

    const minimumGapMs = Math.ceil(1000 / Math.max(qps, 0.01));
    const qpsRetryAfter =
      state.lastRequestAt === null
        ? 0
        : state.lastRequestAt + minimumGapMs - now;
    if (qpsRetryAfter > 0) {
      return {
        granted: false,
        remaining: providerRemaining ?? rollingQuota - requestTimestamps.length,
        retryAfterMs: qpsRetryAfter,
      };
    }

    requestTimestamps.push(now);
    const nextProviderRemaining =
      providerRemaining === null ? null : Math.max(providerRemaining - 1, 0);
    await this.ctx.storage.put(STATE_KEY, {
      lastRequestAt: now,
      providerRemaining: nextProviderRemaining,
      providerResetAt: providerResetActive ? state.providerResetAt : null,
      requestTimestamps,
    } satisfies ProductBudgetState);
    return {
      granted: true,
      remaining:
        nextProviderRemaining ?? rollingQuota - requestTimestamps.length,
      retryAfterMs: 0,
    };
  }

  async syncQuota({
    remaining,
    resetAt,
  }: {
    remaining: number | null;
    resetAt: number | null;
  }): Promise<void> {
    if (remaining === null && resetAt === null) {
      return;
    }
    const state = (await this.ctx.storage.get<ProductBudgetState>(
      STATE_KEY
    )) ?? {
      lastRequestAt: null,
      providerRemaining: null,
      providerResetAt: null,
      requestTimestamps: [],
    };
    await this.ctx.storage.put(STATE_KEY, {
      ...state,
      providerRemaining: remaining ?? state.providerRemaining,
      providerResetAt: resetAt ?? state.providerResetAt,
    } satisfies ProductBudgetState);
  }
}
