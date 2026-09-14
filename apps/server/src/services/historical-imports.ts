export const refreshHistoricalBatch = async (
  db: D1Database,
  batchId: string
): Promise<void> => {
  const counts = await db
    .prepare(
      `SELECT
        COUNT(*) AS accepted,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status IN ('extracted', 'failed') THEN 1 ELSE 0 END) AS processed
       FROM uploads WHERE historical_import_batch_id = ?`
    )
    .bind(batchId)
    .first<{ accepted: number; failed: number; processed: number }>();
  const reviews = await db
    .prepare(
      `SELECT
        SUM(CASE WHEN verification_status = 'verified' THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) AS needs_review
       FROM tickets WHERE historical_import_batch_id = ?`
    )
    .bind(batchId)
    .first<{ needs_review: number; verified: number }>();
  const batch = await db
    .prepare(
      "SELECT duplicate_count, status, total_files FROM historical_import_batches WHERE id = ?"
    )
    .bind(batchId)
    .first<{ duplicate_count: number; status: string; total_files: number }>();
  if (!batch || batch.status === "cancelled") {
    return;
  }
  const rejectedBeforeUpload = Math.max(
    0,
    batch.total_files - batch.duplicate_count - (counts?.accepted ?? 0)
  );
  const failed = (counts?.failed ?? 0) + rejectedBeforeUpload;
  const processed =
    (counts?.processed ?? 0) + batch.duplicate_count + rejectedBeforeUpload;
  const complete = processed >= batch.total_files;
  await db
    .prepare(
      `UPDATE historical_import_batches SET completed_at = ?, failed_count = ?,
       needs_review_count = ?, processed_files = ?, status = ?, updated_at = ?, verified_count = ?
       WHERE id = ?`
    )
    .bind(
      complete ? Date.now() : null,
      failed,
      reviews?.needs_review ?? 0,
      processed,
      complete ? "completed" : "processing",
      Date.now(),
      reviews?.verified ?? 0,
      batchId
    )
    .run();
};
