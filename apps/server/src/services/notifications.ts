import { notificationQueueMessageSchema } from "@ppal/contracts/queues";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const getPreferenceColumn = (notificationType: string): string | null => {
  if (notificationType === "ticket.won") {
    return "ticket_won";
  }
  if (notificationType === "ticket.lost") {
    return "ticket_lost";
  }
  if (notificationType === "leg.won") {
    return "leg_won";
  }
  if (notificationType === "leg.lost") {
    return "leg_lost";
  }
  return null;
};

export const publishNotification = async ({
  body,
  milestoneKey,
  ticketId,
  title,
  type,
  userId,
  workerEnv,
}: {
  body: string;
  milestoneKey: string;
  ticketId: string | null;
  title: string;
  type: string;
  userId: string;
  workerEnv: Env;
}): Promise<void> => {
  const notificationId = crypto.randomUUID();
  const inserted = await workerEnv.DB.prepare(
    `INSERT INTO notifications (body, id, milestone_key, ticket_id, title, type, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(milestone_key) DO NOTHING`
  )
    .bind(body, notificationId, milestoneKey, ticketId, title, type, userId)
    .run();
  if (inserted.meta.changes === 0) {
    return;
  }

  const preferenceColumn = getPreferenceColumn(type);
  const preferenceClause = preferenceColumn
    ? `AND COALESCE(p.${preferenceColumn}, 1) = 1`
    : "";
  const destinations = await workerEnv.DB.prepare(
    `SELECT 'push' AS channel, d.token AS destination FROM device_tokens d
     LEFT JOIN notification_preferences p ON p.user_id = d.user_id
     WHERE d.user_id = ? AND COALESCE(p.push_enabled, 1) = 1 ${preferenceClause}
     UNION ALL
     SELECT 'email' AS channel, u.email AS destination FROM user u
     LEFT JOIN notification_preferences p ON p.user_id = u.id
     WHERE u.id = ? AND COALESCE(p.email_enabled, 1) = 1 ${preferenceClause}`
  )
    .bind(userId, userId)
    .all<{ channel: "email" | "push"; destination: string }>();

  const messages: MessageSendRequest[] = [];
  const statements: D1PreparedStatement[] = [];
  const now = Date.now();

  for (const destination of destinations.results) {
    const deliveryId = crypto.randomUUID();
    statements.push(
      workerEnv.DB.prepare(
        `INSERT INTO notification_deliveries
         (channel, delivery_key, destination, id, notification_id, status, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?) ON CONFLICT(delivery_key) DO NOTHING`
      ).bind(
        destination.channel,
        `${notificationId}:${destination.channel}:${destination.destination}`,
        destination.destination,
        deliveryId,
        notificationId,
        now
      )
    );
    messages.push({ body: { deliveryId }, contentType: "json" });
  }

  if (statements.length > 0) {
    await workerEnv.DB.batch(statements);
  }
  if (messages.length > 0) {
    await workerEnv.NOTIFICATION_QUEUE.sendBatch(messages);
  }
};

interface DeliveryRow {
  body: string;
  channel: "email" | "push";
  destination: string;
  id: string;
  notification_id: string;
  status: string;
  title: string;
}

interface ExpoPushResponse {
  data?: {
    details?: { error?: string };
    id?: string;
    message?: string;
    status?: string;
  };
}

export const processNotificationMessage = async (
  body: unknown,
  workerEnv: Env
): Promise<void> => {
  const { deliveryId } = notificationQueueMessageSchema.parse(body);
  const claim = await workerEnv.DB.prepare(
    `UPDATE notification_deliveries SET status = 'processing', attempts = attempts + 1,
      updated_at = ? WHERE id = ? AND status IN ('pending', 'failed')`
  )
    .bind(Date.now(), deliveryId)
    .run();
  if (claim.meta.changes === 0) {
    return;
  }
  const delivery = await workerEnv.DB.prepare(
    `SELECT d.channel, d.destination, d.id, d.notification_id, d.status,
      n.body, n.title FROM notification_deliveries d
      JOIN notifications n ON n.id = d.notification_id WHERE d.id = ?`
  )
    .bind(deliveryId)
    .first<DeliveryRow>();
  if (!delivery) {
    return;
  }
  try {
    const response =
      delivery.channel === "email"
        ? await fetch("https://api.resend.com/emails", {
            body: JSON.stringify({
              from: workerEnv.RESEND_FROM_EMAIL,
              html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(delivery.title)}</title></head><body><main><h1>${escapeHtml(delivery.title)}</h1><p>${escapeHtml(delivery.body)}</p><p><a href="https://myparlaypal.com/dashboard/notifications">View in ParlayPal</a></p></main></body></html>`,
              subject: delivery.title,
              text: `${delivery.title}\n\n${delivery.body}\n\nView in ParlayPal: https://myparlaypal.com/dashboard/notifications`,
              to: [delivery.destination],
            }),
            headers: {
              authorization: `Bearer ${workerEnv.RESEND_API_KEY}`,
              "content-type": "application/json",
              "idempotency-key": delivery.id,
            },
            method: "POST",
          })
        : await fetch("https://exp.host/--/api/v2/push/send", {
            body: JSON.stringify({
              body: delivery.body,
              data: { notificationId: delivery.notification_id },
              sound: "default",
              title: delivery.title,
              to: delivery.destination,
            }),
            headers: {
              accept: "application/json",
              "accept-encoding": "gzip, deflate",
              "content-type": "application/json",
            },
            method: "POST",
          });
    const result = (await response.json()) as ExpoPushResponse & {
      id?: string;
      message?: string;
    };
    if (
      !response.ok ||
      (delivery.channel === "push" && result.data?.status === "error")
    ) {
      const errorDetail = result.data?.details?.error;
      if (errorDetail === "DeviceNotRegistered") {
        await workerEnv.DB.prepare("DELETE FROM device_tokens WHERE token = ?")
          .bind(delivery.destination)
          .run();
      }
      throw new Error(
        result.data?.message ??
          errorDetail ??
          `Expo push failed (${response.status})`
      );
    }
    const providerReceiptId =
      delivery.channel === "push"
        ? (result.data?.id ?? null)
        : (result.id ?? null);
    await workerEnv.DB.prepare(
      `UPDATE notification_deliveries
       SET status = 'delivered', delivered_at = ?, provider_receipt_id = ?,
           error_message = NULL, updated_at = ?
       WHERE id = ?`
    )
      .bind(Date.now(), providerReceiptId, Date.now(), delivery.id)
      .run();
  } catch (error) {
    await workerEnv.DB.prepare(
      "UPDATE notification_deliveries SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?"
    )
      .bind(
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Unknown delivery error",
        Date.now(),
        delivery.id
      )
      .run();
    throw error;
  }
};

export const processExpoPushReceipts = async (
  workerEnv: Env
): Promise<void> => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentDeliveries = await workerEnv.DB.prepare(
    `SELECT id, provider_receipt_id, destination FROM notification_deliveries
     WHERE channel = 'push' AND status = 'delivered' AND provider_receipt_id IS NOT NULL
       AND delivered_at > ? LIMIT 100`
  )
    .bind(oneDayAgo)
    .all<{ destination: string; id: string; provider_receipt_id: string }>();

  if (!recentDeliveries.results.length) {
    return;
  }

  const ticketIds = recentDeliveries.results.map(
    (delivery) => delivery.provider_receipt_id
  );
  try {
    const response = await fetch(
      "https://exp.host/--/api/v2/push/getReceipts",
      {
        body: JSON.stringify({ ids: ticketIds }),
        headers: {
          accept: "application/json",
          "accept-encoding": "gzip, deflate",
          "content-type": "application/json",
        },
        method: "POST",
      }
    );

    if (!response.ok) {
      return;
    }

    const json = (await response.json()) as {
      data?: Record<
        string,
        {
          details?: { error?: string };
          message?: string;
          status: "error" | "ok";
        }
      >;
    };

    if (!json.data) {
      return;
    }

    const updates: Promise<unknown>[] = [];
    for (const delivery of recentDeliveries.results) {
      const receipt = json.data[delivery.provider_receipt_id];
      if (!receipt) {
        continue;
      }

      if (receipt.status === "error") {
        if (receipt.details?.error === "DeviceNotRegistered") {
          updates.push(
            workerEnv.DB.prepare("DELETE FROM device_tokens WHERE token = ?")
              .bind(delivery.destination)
              .run()
          );
        }
        updates.push(
          workerEnv.DB.prepare(
            "UPDATE notification_deliveries SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?"
          )
            .bind(
              receipt.message ??
                receipt.details?.error ??
                "Push delivery failed",
              Date.now(),
              delivery.id
            )
            .run()
        );
      }
    }
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  } catch {
    // Network or receipt fetch issue; retried next schedule
  }
};
