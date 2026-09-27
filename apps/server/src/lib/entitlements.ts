import type { D1Database } from "@cloudflare/workers-types";

type Plan = "free" | "pro" | "creator";

const planRank: Record<Plan, number> = {
  creator: 3,
  free: 1,
  pro: 2,
};

const activeStatuses = new Set(["trialing", "active", "grace_period"]);

/**
 * Resolve the effective subscription plan for a user.
 *
 * A user must have a `billing_entitlements` row with a paid plan, an active
 * status, and a future `expires_at` timestamp to be considered Pro or Creator.
 * Otherwise they are Free.
 */
export const getUserPlan = async (
  db: D1Database,
  userId: string
): Promise<Plan> => {
  const row = await db
    .prepare(
      `SELECT plan, status, expires_at FROM billing_entitlements
       WHERE user_id = ?
       ORDER BY expires_at DESC NULLS LAST
       LIMIT 1`
    )
    .bind(userId)
    .first<{
      expires_at: number | null;
      plan: Plan;
      status: string;
    }>();

  if (!row) {
    return "free";
  }

  if (!activeStatuses.has(row.status)) {
    return "free";
  }

  if (row.expires_at !== null && row.expires_at <= Date.now()) {
    return "free";
  }

  return row.plan;
};

/**
 * Return true when the user's effective plan is at least `minPlan`.
 */
export const hasPlan = async (
  db: D1Database,
  userId: string,
  minPlan: Plan
): Promise<boolean> => {
  const plan = await getUserPlan(db, userId);
  return planRank[plan] >= planRank[minPlan];
};

export class EntitlementError extends Error {
  public readonly actualPlan: Plan;
  public override readonly name: string = "EntitlementError";
  public readonly requiredPlan: Plan;

  constructor(requiredPlan: Plan, actualPlan: Plan) {
    super(`Plan required: ${requiredPlan}. Current plan: ${actualPlan}.`);
    this.actualPlan = actualPlan;
    this.requiredPlan = requiredPlan;
  }
}

/**
 * Assert that the user's effective plan is at least `minPlan`. If not, throw a
 * clear error that route handlers can turn into a 403 response.
 */
export const assertPlan = async (
  db: D1Database,
  userId: string,
  minPlan: Plan
): Promise<void> => {
  const plan = await getUserPlan(db, userId);
  if (planRank[plan] < planRank[minPlan]) {
    throw new EntitlementError(minPlan, plan);
  }
};
