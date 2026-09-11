/* oxlint-disable no-await-in-loop -- SSE streaming connection yields updates over time */

import { zValidator } from "@hono/zod-validator";
import type { Auth } from "@ppal/auth";
import { notificationPreferencesSchema } from "@ppal/contracts/notifications";
import { env } from "@ppal/env/server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { getAuthUser } from "../lib/auth";
import { safeJsonParse } from "../lib/database";

const STREAM_DURATION_MS = 60_000;
const STREAM_LEASE_MS = 75_000;
const MAX_REPLAY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const preferenceSelect = `SELECT email_enabled, in_app_enabled, leg_lost,
  leg_won, push_enabled, ticket_lost, ticket_won
  FROM notification_preferences WHERE user_id = ?`;

interface PreferenceRow {
  email_enabled: number;
  in_app_enabled: number;
  leg_lost: number;
  leg_won: number;
  push_enabled: number;
  ticket_lost: number;
  ticket_won: number;
}

const mapPreferences = (row?: PreferenceRow | null) => ({
  emailEnabled: (row?.email_enabled ?? 1) === 1,
  inAppEnabled: (row?.in_app_enabled ?? 1) === 1,
  legLost: (row?.leg_lost ?? 1) === 1,
  legWon: (row?.leg_won ?? 1) === 1,
  pushEnabled: (row?.push_enabled ?? 1) === 1,
  ticketLost: (row?.ticket_lost ?? 1) === 1,
  ticketWon: (row?.ticket_won ?? 1) === 1,
});

interface NotificationRow {
  body: string;
  created_at: number;
  data: string | null;
  id: string;
  read_at: number | null;
  ticket_id: string | null;
  title: string;
  type: string;
}

const mapNotification = (row: NotificationRow) => ({
  body: row.body,
  createdAt: new Date(row.created_at).toISOString(),
  data: safeJsonParse<Record<string, unknown> | null>(row.data, null),
  id: row.id,
  readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
  ticketId: row.ticket_id,
  title: row.title,
  type: row.type,
});

export const createNotificationRoutes = (auth: Auth) =>
  new Hono()
    .get("/notifications", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const rows = await env.DB.prepare(
        `SELECT body, created_at, data, id, read_at, ticket_id, title, type
         FROM notifications WHERE user_id = ? AND in_app_visible = 1
         ORDER BY created_at DESC LIMIT 100`
      )
        .bind(user.id)
        .all<NotificationRow>();
      return c.json({ notifications: rows.results.map(mapNotification) });
    })
    .get("/notifications/stream", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const now = Date.now();
      const requestedAfterValue = c.req.query("after");
      const requestedAfter = Number(requestedAfterValue ?? now);
      if (requestedAfterValue && !Number.isSafeInteger(requestedAfter)) {
        return c.json(
          { code: "INVALID_CURSOR", error: "after must be a timestamp" },
          400
        );
      }
      const lastEventId = c.req.header("last-event-id");
      const resumed = lastEventId
        ? await env.DB.prepare(
            "SELECT created_at FROM notifications WHERE id = ? AND user_id = ?"
          )
            .bind(lastEventId, user.id)
            .first<{ created_at: number }>()
        : null;
      const initialAfter = Math.min(
        now,
        Math.max(now - MAX_REPLAY_AGE_MS, resumed?.created_at ?? requestedAfter)
      );
      const connectionId = crypto.randomUUID();
      const lease = await env.DB.prepare(
        `INSERT INTO notification_stream_leases (connection_id, expires_at, user_id)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           connection_id = excluded.connection_id,
           expires_at = excluded.expires_at
         WHERE notification_stream_leases.expires_at <= ?
         RETURNING connection_id`
      )
        .bind(connectionId, now + STREAM_LEASE_MS, user.id, now)
        .first<{ connection_id: string }>();
      if (!lease) {
        return c.json(
          {
            code: "STREAM_ALREADY_OPEN",
            error: "Only one notification stream may be open per account",
          },
          409
        );
      }
      return streamSSE(c, async (stream) => {
        let after = initialAfter;
        try {
          const streamStartedAt = Date.now();
          while (
            Date.now() - streamStartedAt < STREAM_DURATION_MS &&
            !stream.aborted
          ) {
            const rows = await env.DB.prepare(
              `SELECT body, created_at, data, id, read_at, ticket_id, title, type
               FROM notifications WHERE user_id = ? AND in_app_visible = 1
                 AND created_at > ?
               ORDER BY created_at, id LIMIT 100`
            )
              .bind(user.id, after)
              .all<NotificationRow>();
            for (const row of rows.results) {
              after = Math.max(after, row.created_at);
              await stream.writeSSE({
                data: JSON.stringify(mapNotification(row)),
                event: "notification",
                id: row.id,
              });
            }
            await stream.writeSSE({
              data: JSON.stringify({ at: Date.now() }),
              event: "heartbeat",
            });
            await stream.sleep(5000);
          }
        } finally {
          await env.DB.prepare(
            "DELETE FROM notification_stream_leases WHERE user_id = ? AND connection_id = ?"
          )
            .bind(user.id, connectionId)
            .run();
        }
      });
    })
    .patch("/notifications/:notificationId/read", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const result = await env.DB.prepare(
        "UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?"
      )
        .bind(Date.now(), c.req.param("notificationId"), user.id)
        .run();
      return result.meta.changes > 0
        ? c.json({ read: true }, 200)
        : c.json({ code: "NOT_FOUND", error: "Notification not found" }, 404);
    })
    .get("/settings/notifications", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const preferences = await env.DB.prepare(preferenceSelect)
        .bind(user.id)
        .first<PreferenceRow>();
      return c.json({
        preferences: mapPreferences(preferences),
      });
    })
    .patch(
      "/settings/notifications",
      zValidator("json", notificationPreferencesSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers);
        if (!user) {
          return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
        }
        const input = c.req.valid("json");
        await env.DB.prepare(
          `INSERT INTO notification_preferences (
            email_enabled, in_app_enabled, leg_lost, leg_won, push_enabled,
            ticket_lost, ticket_won, updated_at, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            email_enabled = excluded.email_enabled,
            in_app_enabled = excluded.in_app_enabled,
            leg_lost = excluded.leg_lost, leg_won = excluded.leg_won,
            push_enabled = excluded.push_enabled,
            ticket_lost = excluded.ticket_lost, ticket_won = excluded.ticket_won,
            updated_at = excluded.updated_at`
        )
          .bind(
            Number(input.emailEnabled),
            Number(input.inAppEnabled),
            Number(input.legLost),
            Number(input.legWon),
            Number(input.pushEnabled),
            Number(input.ticketLost),
            Number(input.ticketWon),
            Date.now(),
            user.id
          )
          .run();
        const preferences = await env.DB.prepare(preferenceSelect)
          .bind(user.id)
          .first<PreferenceRow>();
        return c.json({ preferences: mapPreferences(preferences) });
      }
    )
    .delete("/notifications/devices", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const body = (await c.req.json().catch(() => null)) as {
        token?: unknown;
      } | null;
      const token =
        typeof body?.token === "string" ? body.token.trim() : undefined;
      if (!token) {
        return c.json(
          { code: "INVALID_TOKEN", error: "Token is required" },
          400
        );
      }
      const result = await env.DB.prepare(
        "DELETE FROM device_tokens WHERE user_id = ? AND token = ?"
      )
        .bind(user.id, token)
        .run();
      return c.json({ deleted: result.meta.changes > 0 });
    });
