export const recordOperationFailure = async ({
  attempts,
  body,
  error,
  messageId,
  queue,
  workerEnv,
}: {
  attempts: number;
  body: unknown;
  error: unknown;
  messageId: string;
  queue: string;
  workerEnv: Env;
}): Promise<void> => {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown queue error";
  await workerEnv.DB.prepare(
    `INSERT INTO operation_failures (attempts, error_message, id, message_id, payload, queue, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'failed', ?)
     ON CONFLICT(queue, message_id) DO UPDATE SET attempts = excluded.attempts,
       error_message = excluded.error_message, payload = excluded.payload, status = 'failed',
       updated_at = excluded.updated_at`
  )
    .bind(
      attempts,
      errorMessage.slice(0, 2000),
      crypto.randomUUID(),
      messageId,
      JSON.stringify(body),
      queue,
      Date.now()
    )
    .run();
};
