import { env } from "@ppal/env/server";

interface AuditEvent {
  action: string;
  actorUserId: string | null;
  metadata?: Record<string, unknown>;
  outcome: "denied" | "failure" | "success";
  request: Request;
  targetId: string | null;
  targetType: string;
}

export const writeAuditEvent = async (event: AuditEvent): Promise<void> => {
  await env.DB.prepare(
    `INSERT INTO audit_logs (
      action, actor_user_id, id, ip_country, metadata, occurred_at, outcome,
      request_id, target_id, target_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      event.action,
      event.actorUserId,
      crypto.randomUUID(),
      event.request.headers.get("cf-ipcountry"),
      event.metadata ? JSON.stringify(event.metadata) : null,
      Date.now(),
      event.outcome,
      event.request.headers.get("cf-ray"),
      event.targetId,
      event.targetType
    )
    .run();
};
