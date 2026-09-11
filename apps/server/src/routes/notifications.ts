/* oxlint-disable no-await-in-loop -- SSE streaming connection yields updates over time */

import { zValidator } from "@hono/zod-validator";
import type { Auth } from "@ppal/auth";
import { notificationPreferencesSchema } from "@ppal/contracts/notifications";
import { env } from "@ppal/env/server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { getAuthUser } from "../lib/auth";

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
  data: row.data ? (JSON.parse(row.data) as Record<string, unknown>) : null,
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
         FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
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
      const requestedAfter = Number(c.req.query("after") ?? 0);
      const initialAfter = Number.isFinite(requestedAfter) ? requestedAfter : 0;
      return streamSSE(c, async (stream) => {
        let after = initialAfter;
        for (
          let heartbeat = 0;
          heartbeat < 12 && !stream.aborted;
          heartbeat += 1
        ) {
          const rows = await env.DB.prepare(
            `SELECT body, created_at, data, id, read_at, ticket_id, title, type
             FROM notifications WHERE user_id = ? AND created_at > ? ORDER BY created_at LIMIT 100`
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
      let token = c.req.query("token");
      if (!token) {
        try {
          const { token: bodyToken } = (await c.req.json()) as {
            token?: string;
          };
          token = bodyToken;
        } catch {
          // Non-JSON or empty body
        }
      }
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
