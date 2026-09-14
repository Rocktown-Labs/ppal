const MONTHLY_UPLOAD_LIMITS = {
  creator: 1000,
  free: 5,
  pro: 500,
} as const;

const getUtcMonthBounds = (now: Date): { end: number; start: number } => {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return { end, start };
};

export type UsageReservationResult =
  | { reserved: true }
  | { reason: "quota_exceeded"; reserved: false };

export const reserveUploadUsage = async ({
  db,
  idempotencyKey,
  uploadId,
  userId,
}: {
  db: D1Database;
  idempotencyKey: string;
  uploadId: string;
  userId: string;
}): Promise<UsageReservationResult> => {
  const now = new Date();
  const { end, start } = getUtcMonthBounds(now);
  const result = await db
    .prepare(
      `INSERT INTO usage_events (
        id, idempotency_key, metadata, occurred_at, period_end, period_start,
        quantity, resource_id, resource_type, status, type, updated_at, user_id
      )
      SELECT ?, ?, NULL, ?, ?, ?, 1, ?, 'upload', 'reserved', 'ticket_upload', ?, ?
      WHERE (
        SELECT COALESCE(SUM(quantity), 0)
        FROM usage_events
        WHERE user_id = ? AND type = 'ticket_upload' AND status != 'released'
          AND period_start = ? AND period_end = ?
      ) < CASE
        WHEN EXISTS (
          SELECT 1 FROM billing_entitlements
          WHERE user_id = ? AND plan = 'creator'
            AND status IN ('trialing', 'active', 'grace_period')
            AND (expires_at IS NULL OR expires_at > ?)
        ) THEN ?
        WHEN EXISTS (
          SELECT 1 FROM billing_entitlements
          WHERE user_id = ? AND plan = 'pro'
            AND status IN ('trialing', 'active', 'grace_period')
            AND (expires_at IS NULL OR expires_at > ?)
        ) THEN ?
        ELSE ?
      END
      ON CONFLICT(idempotency_key) DO NOTHING`
    )
    .bind(
      crypto.randomUUID(),
      idempotencyKey,
      now.getTime(),
      end,
      start,
      uploadId,
      now.getTime(),
      userId,
      userId,
      start,
      end,
      userId,
      now.getTime(),
      MONTHLY_UPLOAD_LIMITS.creator,
      userId,
      now.getTime(),
      MONTHLY_UPLOAD_LIMITS.pro,
      MONTHLY_UPLOAD_LIMITS.free
    )
    .run();

  if (result.meta.changes > 0) {
    return { reserved: true };
  }

  const existing = await db
    .prepare(
      "SELECT id FROM usage_events WHERE idempotency_key = ? AND user_id = ?"
    )
    .bind(idempotencyKey, userId)
    .first();

  return existing
    ? { reserved: true }
    : { reason: "quota_exceeded", reserved: false };
};

export const releaseUploadUsage = async (
  db: D1Database,
  idempotencyKey: string
): Promise<void> => {
  await db
    .prepare(
      "UPDATE usage_events SET status = 'released', updated_at = ? WHERE idempotency_key = ? AND status = 'reserved'"
    )
    .bind(Date.now(), idempotencyKey)
    .run();
};
