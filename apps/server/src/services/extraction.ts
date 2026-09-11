import { extractionQueueMessageSchema } from "@ppal/contracts/queues";
import type { ExtractionResult } from "@ppal/contracts/uploads";

import { extractTicketWithGemini } from "./gemini";
import { refreshHistoricalBatch } from "./historical-imports";
import { publishNotification } from "./notifications";

interface UploadRow {
  id: string;
  ingestion_mode: "historical" | "live";
  historical_import_batch_id: string | null;
  mime_type: string;
  object_key: string;
  status: string;
  usage_reservation_key: string;
  user_id: string;
}

const createTicketStatements = ({
  db,
  extraction,
  extractionId,
  ticketId,
  upload,
}: {
  db: D1Database;
  extraction: ExtractionResult;
  extractionId: string;
  ticketId: string;
  upload: UploadRow;
}): D1PreparedStatement[] => {
  const now = Date.now();
  const statements = [
    db
      .prepare(
        `INSERT INTO tickets (
          displayed_result, historical_import_batch_id, id, ingestion_mode, source_name,
          source_upload_id, status, ticket_type, updated_at, user_id, verification_status, version
        ) VALUES (?, ?, ?, ?, ?, ?, 'needs_review', ?, ?, ?, 'unverified', 1)`
      )
      .bind(
        extraction.displayedResult,
        upload.historical_import_batch_id,
        ticketId,
        upload.ingestion_mode,
        extraction.sourceName,
        upload.id,
        extraction.ticketType,
        now,
        upload.user_id
      ),
  ];

  for (const leg of extraction.legs) {
    statements.push(
      db
        .prepare(
          `INSERT INTO ticket_legs (
            display_description, event_hint, id, market_components, operator, raw_description,
            raw_league_name, raw_market_name, raw_sport_name, resolver_confidence, resolver_status,
            secondary_target_value, status, subject_name,
            subject_type, target_value, ticket_id, updated_at, version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ambiguous', ?, 'pending', ?, ?, ?, ?, ?, 1)`
        )
        .bind(
          leg.description,
          leg.eventHint ? JSON.stringify({ raw: leg.eventHint }) : null,
          crypto.randomUUID(),
          JSON.stringify(leg.marketComponents),
          leg.operator,
          leg.description,
          leg.league,
          leg.market,
          leg.sport,
          leg.confidence,
          leg.secondaryTargetValue,
          leg.subjectName,
          leg.subjectType,
          leg.targetValue,
          ticketId,
          now
        )
    );
  }

  statements.push(
    db
      .prepare(
        `UPDATE extractions SET status = 'completed', normalized_response = ?,
          updated_at = ? WHERE id = ?`
      )
      .bind(JSON.stringify(extraction), now, extractionId),
    db
      .prepare(
        "UPDATE uploads SET status = 'extracted', ready_at = ?, updated_at = ? WHERE id = ?"
      )
      .bind(now, now, upload.id),
    db
      .prepare(
        "UPDATE usage_events SET status = 'finalized', updated_at = ? WHERE idempotency_key = ? AND status = 'reserved'"
      )
      .bind(now, upload.usage_reservation_key),
    db
      .prepare(
        `INSERT INTO ticket_timeline_events (
          id, message, occurred_at, ticket_id, title, transition_key, type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        "Review the extracted fields before tracking begins.",
        now,
        ticketId,
        "Ticket extracted",
        `${ticketId}:extracted:v1`,
        "ticket.extracted"
      )
  );
  return statements;
};

export const processExtractionMessage = async (
  body: unknown,
  workerEnv: Env
): Promise<void> => {
  const message = extractionQueueMessageSchema.parse(body);
  const claim = await workerEnv.DB.prepare(
    `UPDATE uploads SET status = 'processing', updated_at = ?
     WHERE id = ? AND status = 'ready'`
  )
    .bind(Date.now(), message.uploadId)
    .run();

  if (claim.meta.changes === 0) {
    const current = await workerEnv.DB.prepare(
      "SELECT status FROM uploads WHERE id = ?"
    )
      .bind(message.uploadId)
      .first<{ status: string }>();
    if (current?.status === "processing") {
      throw new Error(`Upload ${message.uploadId} is already processing`);
    }
    return;
  }

  const upload = await workerEnv.DB.prepare(
    `SELECT historical_import_batch_id, id, ingestion_mode, mime_type, object_key, status,
      usage_reservation_key, user_id FROM uploads WHERE id = ?`
  )
    .bind(message.uploadId)
    .first<UploadRow>();
  if (!upload?.mime_type) {
    throw new Error(`Upload ${message.uploadId} is missing metadata`);
  }

  const extractionId = crypto.randomUUID();
  await workerEnv.DB.prepare(
    `INSERT INTO extractions (
      id, provider, schema_version, status, updated_at, upload_id
    ) VALUES (?, 'gemini', '2', 'pending', ?, ?)`
  )
    .bind(extractionId, Date.now(), upload.id)
    .run();

  try {
    const object = await workerEnv.R2_UPLOADS.get(upload.object_key);
    if (!object) {
      throw new Error(`R2 object missing for upload ${upload.id}`);
    }
    const extracted = await extractTicketWithGemini({
      apiKey: workerEnv.GEMINI_API_KEY,
      bytes: await object.arrayBuffer(),
      mimeType: upload.mime_type,
    });
    const ticketId = crypto.randomUUID();
    const statements = createTicketStatements({
      db: workerEnv.DB,
      extraction: extracted.result,
      extractionId,
      ticketId,
      upload,
    });
    statements.unshift(
      workerEnv.DB.prepare(
        "UPDATE extractions SET model = ?, raw_response = ?, updated_at = ? WHERE id = ?"
      ).bind(
        extracted.model,
        JSON.stringify(extracted.raw),
        Date.now(),
        extractionId
      )
    );
    await workerEnv.DB.batch(statements);
    if (upload.historical_import_batch_id) {
      await refreshHistoricalBatch(
        workerEnv.DB,
        upload.historical_import_batch_id
      );
    }
    await publishNotification({
      body: "Your betting slip is ready to review.",
      milestoneKey: `${upload.id}:extracted`,
      ticketId,
      title: "Ticket extracted",
      type: "ticket.extracted",
      userId: upload.user_id,
      workerEnv,
    });
    workerEnv.ANALYTICS.writeDataPoint({
      blobs: ["extraction.completed", upload.user_id, extracted.model],
      doubles: [extracted.result.legs.length],
      indexes: [upload.id],
    });
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Unknown extraction error";
    await workerEnv.DB.batch([
      workerEnv.DB.prepare(
        "UPDATE extractions SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?"
      ).bind(messageText.slice(0, 1000), Date.now(), extractionId),
      workerEnv.DB.prepare(
        "UPDATE uploads SET status = 'ready', updated_at = ? WHERE id = ?"
      ).bind(Date.now(), upload.id),
    ]);
    throw error;
  }
};

export const markExtractionTerminalFailure = async (
  body: unknown,
  workerEnv: Env,
  error: unknown
): Promise<void> => {
  const message = extractionQueueMessageSchema.safeParse(body);
  if (!message.success) {
    return;
  }
  const upload = await workerEnv.DB.prepare(
    "SELECT usage_reservation_key FROM uploads WHERE id = ?"
  )
    .bind(message.data.uploadId)
    .first<{ usage_reservation_key: string }>();
  if (!upload) {
    return;
  }
  await workerEnv.DB.batch([
    workerEnv.DB.prepare(
      "UPDATE uploads SET status = 'failed', updated_at = ? WHERE id = ?"
    ).bind(Date.now(), message.data.uploadId),
    workerEnv.DB.prepare(
      "UPDATE usage_events SET status = 'released', updated_at = ?, metadata = ? WHERE idempotency_key = ? AND status = 'reserved'"
    ).bind(
      Date.now(),
      JSON.stringify({
        terminalError:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown error",
      }),
      upload.usage_reservation_key
    ),
  ]);
  const failedUpload = await workerEnv.DB.prepare(
    "SELECT historical_import_batch_id FROM uploads WHERE id = ?"
  )
    .bind(message.data.uploadId)
    .first<{ historical_import_batch_id: string | null }>();
  if (failedUpload?.historical_import_batch_id) {
    await refreshHistoricalBatch(
      workerEnv.DB,
      failedUpload.historical_import_batch_id
    );
  }
};
