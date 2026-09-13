import { DurableObject } from "cloudflare:workers";

interface ProductBudgetState {
  lastRequestAt: number | null;
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

/** Serializes calls for one Sportradar product across every queue consumer. */
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
      requestTimestamps: [],
    };
    const windowStart = now - rollingWindowMs;
    const requestTimestamps = state.requestTimestamps.filter(
      (timestamp) => timestamp > windowStart
    );
    if (requestTimestamps.length >= rollingQuota) {
      const oldest = requestTimestamps[0] ?? now;
      await this.ctx.storage.put(STATE_KEY, {
        lastRequestAt: state.lastRequestAt,
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
        remaining: rollingQuota - requestTimestamps.length,
        retryAfterMs: qpsRetryAfter,
      };
    }

    requestTimestamps.push(now);
    await this.ctx.storage.put(STATE_KEY, {
      lastRequestAt: now,
      requestTimestamps,
    } satisfies ProductBudgetState);
    return {
      granted: true,
      remaining: rollingQuota - requestTimestamps.length,
      retryAfterMs: 0,
    };
  }
}
