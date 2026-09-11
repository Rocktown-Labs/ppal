import { zValidator } from "@hono/zod-validator";
import type { Auth } from "@ppal/auth";
import { manualVerificationSchema } from "@ppal/contracts/imports";
import type {
  TicketContract,
  TicketLegContract,
} from "@ppal/contracts/tickets";
import { reviewTicketRequestSchema } from "@ppal/contracts/tickets";
import { env } from "@ppal/env/server";
import { Hono } from "hono";

import { getAuthUser } from "../lib/auth";
import { writeAuditEvent } from "../services/audit";
import { refreshHistoricalBatch } from "../services/historical-imports";
import { qualifyReferral } from "./referrals";

interface TicketRow {
  confirmed_at: number | null;
  created_at: number;
  displayed_result: "won" | "lost" | "push" | "void" | null;
  id: string;
  ingestion_mode: TicketContract["ingestionMode"];
  result_source: TicketContract["resultSource"];
  settled_at: number | null;
  source_name: string | null;
  source_upload_id: string | null;
  status: TicketContract["status"];
  ticket_type: TicketContract["ticketType"];
  tracking_started_at: number | null;
  updated_at: number;
  verification_status: TicketContract["verificationStatus"];
  verified_at: number | null;
}

interface TicketLegRow {
  current_value: number | null;
  display_description: string | null;
  id: string;
  league_id: string | null;
  lost_at: number | null;
  market_id: string | null;
  market_components: string | null;
  operator: TicketLegContract["operator"];
  participant_id: string | null;
  raw_description: string;
  resolver_confidence: number | null;
  resolver_status: TicketLegContract["resolverStatus"];
  secondary_target_value: number | null;
  settled_at: number | null;
  sport_id: string | null;
  sports_event_id: string | null;
  status: TicketLegContract["status"];
  subject_name: string;
  subject_type: TicketLegContract["subjectType"];
  target_value: number | null;
  ticket_id: string;
  won_at: number | null;
}

const dateString = (value: number | null): string | null =>
  value === null ? null : new Date(value).toISOString();

const mapLeg = (leg: TicketLegRow): TicketLegContract => ({
  currentValue: leg.current_value,
  displayDescription: leg.display_description,
  id: leg.id,
  leagueId: leg.league_id,
  lostAt: dateString(leg.lost_at),
  marketId: leg.market_id,
  marketComponents: leg.market_components
    ? (JSON.parse(leg.market_components) as string[])
    : [],
  operator: leg.operator,
  participantId: leg.participant_id,
  rawDescription: leg.raw_description,
  resolverConfidence: leg.resolver_confidence,
  resolverStatus: leg.resolver_status,
  secondaryTargetValue: leg.secondary_target_value,
  settledAt: dateString(leg.settled_at),
  sportId: leg.sport_id,
  sportsEventId: leg.sports_event_id,
  status: leg.status,
  subjectName: leg.subject_name,
  subjectType: leg.subject_type,
  targetValue: leg.target_value,
  ticketId: leg.ticket_id,
  wonAt: dateString(leg.won_at),
});

const getTicket = async (ticketId: string, userId: string) => {
  const ticket = await env.DB.prepare(
    `SELECT confirmed_at, created_at, displayed_result, id, ingestion_mode, result_source,
      settled_at, source_name, source_upload_id, status, ticket_type,
      tracking_started_at, updated_at, verification_status, verified_at
     FROM tickets WHERE id = ? AND user_id = ?`
  )
    .bind(ticketId, userId)
    .first<TicketRow>();
  if (!ticket) {
    return null;
  }
  const legs = await env.DB.prepare(
    `SELECT current_value, display_description, id, league_id, lost_at,
      market_id, market_components, operator, participant_id, raw_description,
      resolver_confidence, resolver_status, secondary_target_value,
      settled_at, sport_id, sports_event_id, status, subject_name,
      subject_type, target_value, ticket_id, won_at
     FROM ticket_legs WHERE ticket_id = ? ORDER BY created_at, id`
  )
    .bind(ticketId)
    .all<TicketLegRow>();
  return {
    confirmedAt: dateString(ticket.confirmed_at),
    createdAt: new Date(ticket.created_at).toISOString(),
    displayedResult: ticket.displayed_result,
    id: ticket.id,
    ingestionMode: ticket.ingestion_mode,
    legs: legs.results.map(mapLeg),
    resultSource: ticket.result_source,
    settledAt: dateString(ticket.settled_at),
    sourceName: ticket.source_name,
    sourceUploadId: ticket.source_upload_id,
    status: ticket.status,
    ticketType: ticket.ticket_type,
    trackingStartedAt: dateString(ticket.tracking_started_at),
    updatedAt: new Date(ticket.updated_at).toISOString(),
    verificationStatus: ticket.verification_status,
    verifiedAt: dateString(ticket.verified_at),
  } satisfies TicketContract;
};

export const createTicketRoutes = (auth: Auth) =>
  new Hono()
    .get("/", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const cursor = c.req.query("cursor") ?? null;
      const limit = Math.min(
        Math.max(Number(c.req.query("limit") ?? 20), 1),
        100
      );
      const rows = await env.DB.prepare(
        `SELECT id, created_at FROM tickets WHERE user_id = ?
         AND (? IS NULL OR created_at < ?)
         ORDER BY created_at DESC LIMIT ?`
      )
        .bind(user.id, cursor, cursor ? Number(cursor) : null, limit + 1)
        .all<{ created_at: number; id: string }>();
      const hasMore = rows.results.length > limit;
      const page = rows.results.slice(0, limit);
      const loadedTickets = await Promise.all(
        page.map(({ id }) => getTicket(id, user.id))
      );
      const tickets = loadedTickets.filter(
        (ticket): ticket is TicketContract => ticket !== null
      );
      const last = page.at(-1);
      return c.json({
        nextCursor: hasMore && last ? String(last.created_at) : null,
        tickets,
      });
    })
    .get("/:ticketId", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const ticket = await getTicket(c.req.param("ticketId"), user.id);
      return ticket
        ? c.json({ ticket }, 200)
        : c.json({ code: "NOT_FOUND", error: "Ticket not found" }, 404);
    })
    .patch(
      "/:ticketId/review",
      zValidator("json", reviewTicketRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers);
        if (!user) {
          return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
        }
        const ticketId = c.req.param("ticketId");
        const ticket = await env.DB.prepare(
          "SELECT id, status FROM tickets WHERE id = ? AND user_id = ?"
        )
          .bind(ticketId, user.id)
          .first<{ id: string; status: string }>();
        if (!ticket) {
          return c.json({ code: "NOT_FOUND", error: "Ticket not found" }, 404);
        }
        if (
          !(["draft", "needs_review"] as const).includes(
            ticket.status as "draft" | "needs_review"
          )
        ) {
          return c.json(
            {
              code: "INVALID_STATE",
              error: "A tracked or settled ticket cannot be edited",
            },
            409
          );
        }
        const input = c.req.valid("json");
        const existingLegs = await env.DB.prepare(
          "SELECT id FROM ticket_legs WHERE ticket_id = ?"
        )
          .bind(ticketId)
          .all<{ id: string }>();
        const existingIds = new Set(existingLegs.results.map(({ id }) => id));
        if (
          input.legs.length !== existingIds.size ||
          input.legs.some((leg) => !existingIds.has(leg.id))
        ) {
          return c.json(
            {
              code: "INVALID_LEGS",
              error:
                "Review must include every existing ticket leg exactly once",
            },
            400
          );
        }
        const now = Date.now();
        const updates = input.legs.map((leg) =>
          env.DB.prepare(
            `UPDATE ticket_legs SET display_description = ?, league_id = ?,
              market_id = ?, operator = ?, participant_id = ?,
              resolver_status = CASE
                WHEN ? IS NOT NULL AND ? IS NOT NULL
                  AND (? = 'game' OR ? IS NOT NULL) THEN 'resolved'
                ELSE 'ambiguous'
              END,
              secondary_target_value = ?, sport_id = ?, sports_event_id = ?,
              subject_name = ?, subject_type = ?, target_value = ?,
              updated_at = ?, version = version + 1 WHERE id = ? AND ticket_id = ?`
          ).bind(
            leg.displayDescription,
            leg.leagueId,
            leg.marketId,
            leg.operator,
            leg.participantId,
            leg.sportsEventId,
            leg.marketId,
            leg.subjectType,
            leg.participantId,
            leg.secondaryTargetValue,
            leg.sportId,
            leg.sportsEventId,
            leg.subjectName,
            leg.subjectType,
            leg.targetValue,
            now,
            leg.id,
            ticketId
          )
        );
        await env.DB.batch([
          ...updates,
          env.DB.prepare(
            "UPDATE tickets SET updated_at = ?, version = version + 1 WHERE id = ? AND user_id = ?"
          ).bind(now, ticketId, user.id),
        ]);
        await writeAuditEvent({
          action: "ticket.review",
          actorUserId: user.id,
          metadata: { legCount: input.legs.length },
          outcome: "success",
          request: c.req.raw,
          targetId: ticketId,
          targetType: "ticket",
        });
        const reviewed = await getTicket(ticketId, user.id);
        return c.json({ ticket: reviewed }, 200);
      }
    )
    .post("/:ticketId/confirm", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const ticketId = c.req.param("ticketId");
      const unresolved = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM ticket_legs l
         JOIN tickets t ON t.id = l.ticket_id
         WHERE t.id = ? AND t.user_id = ? AND l.resolver_status != 'resolved'`
      )
        .bind(ticketId, user.id)
        .first<{ count: number }>();
      if (!unresolved) {
        return c.json({ code: "NOT_FOUND", error: "Ticket not found" }, 404);
      }
      if (unresolved.count > 0) {
        await writeAuditEvent({
          action: "ticket.confirm",
          actorUserId: user.id,
          metadata: { reason: "unresolved_legs", unresolved: unresolved.count },
          outcome: "denied",
          request: c.req.raw,
          targetId: ticketId,
          targetType: "ticket",
        });
        return c.json(
          {
            code: "UNRESOLVED_LEGS",
            error: "Every leg must resolve to a provider event before tracking",
          },
          409
        );
      }
      const now = Date.now();
      const legs = await env.DB.prepare(
        `SELECT id, market_id, participant_id, sports_event_id
         FROM ticket_legs WHERE ticket_id = ?`
      )
        .bind(ticketId)
        .all<{
          id: string;
          market_id: string;
          participant_id: string | null;
          sports_event_id: string;
        }>();
      const trackingStatements = legs.results.map((leg) =>
        env.DB.prepare(
          `INSERT INTO tracking_subscriptions (
            id, market_id, participant_id, sports_event_id, status,
            subscription_key, ticket_leg_id, updated_at
          ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
          ON CONFLICT(subscription_key) DO NOTHING`
        ).bind(
          crypto.randomUUID(),
          leg.market_id,
          leg.participant_id,
          leg.sports_event_id,
          `${leg.id}:${leg.sports_event_id}:${leg.participant_id ?? "game"}:${leg.market_id}`,
          leg.id,
          now
        )
      );
      const confirmation = env.DB.prepare(
        `UPDATE tickets SET confirmed_at = ?, status = 'scheduled',
          tracking_started_at = ?, updated_at = ?, version = version + 1
         WHERE id = ? AND user_id = ? AND status IN ('draft', 'needs_review')`
      ).bind(now, now, now, ticketId, user.id);
      const eventStatements = [
        ...new Set(legs.results.map((leg) => leg.sports_event_id)),
      ].map((eventId) =>
        env.DB.prepare(
          "UPDATE sports_events SET next_poll_at = MIN(COALESCE(next_poll_at, ?), ?), updated_at = ? WHERE id = ?"
        ).bind(now, now, now, eventId)
      );
      const [result] = await env.DB.batch([
        confirmation,
        ...trackingStatements,
        ...eventStatements,
      ]);
      if (!result || result.meta.changes === 0) {
        return c.json(
          {
            code: "INVALID_STATE",
            error: "Ticket cannot be confirmed in its current state",
          },
          409
        );
      }
      await writeAuditEvent({
        action: "ticket.confirm",
        actorUserId: user.id,
        outcome: "success",
        request: c.req.raw,
        targetId: ticketId,
        targetType: "ticket",
      });
      await qualifyReferral(env.DB, user.id);
      const confirmed = await getTicket(ticketId, user.id);
      return c.json({ ticket: confirmed }, 200);
    })
    .post("/:ticketId/cancel", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const ticketId = c.req.param("ticketId");
      const now = Date.now();
      const result = await env.DB.prepare(
        `UPDATE tickets SET result_source = 'manual', settled_at = ?, status = 'void', updated_at = ?, version = version + 1
         WHERE id = ? AND user_id = ? AND status NOT IN ('won', 'lost', 'push', 'void', 'partially_void', 'settled')`
      )
        .bind(now, now, ticketId, user.id)
        .run();
      if (result.meta.changes === 0) {
        return c.json(
          { code: "INVALID_STATE", error: "Ticket cannot be cancelled" },
          409
        );
      }
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE ticket_legs SET status = 'cancelled', settled_at = ?, updated_at = ? WHERE ticket_id = ? AND status IN ('pending', 'live', 'unresolved')"
        ).bind(now, now, ticketId),
        env.DB.prepare(
          "UPDATE tracking_subscriptions SET status = 'cancelled', updated_at = ? WHERE ticket_leg_id IN (SELECT id FROM ticket_legs WHERE ticket_id = ?)"
        ).bind(now, ticketId),
        env.DB.prepare(
          `INSERT INTO ticket_timeline_events (id, occurred_at, ticket_id, title, transition_key, type)
           VALUES (?, ?, ?, 'Ticket cancelled', ?, 'ticket.cancelled') ON CONFLICT(transition_key) DO NOTHING`
        ).bind(crypto.randomUUID(), now, ticketId, `${ticketId}:cancelled`),
      ]);
      await writeAuditEvent({
        action: "ticket.cancel",
        actorUserId: user.id,
        outcome: "success",
        request: c.req.raw,
        targetId: ticketId,
        targetType: "ticket",
      });
      return c.json({ ticket: await getTicket(ticketId, user.id) });
    })
    .post(
      "/:ticketId/manual-settlement",
      zValidator("json", manualVerificationSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers);
        if (!user) {
          return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
        }
        const ticketId = c.req.param("ticketId");
        const ticket = await env.DB.prepare(
          "SELECT historical_import_batch_id, id FROM tickets WHERE id = ? AND user_id = ?"
        )
          .bind(ticketId, user.id)
          .first<{ historical_import_batch_id: string | null; id: string }>();
        if (!ticket) {
          return c.json({ code: "NOT_FOUND", error: "Ticket not found" }, 404);
        }
        const input = c.req.valid("json");
        const ownedLegs = await env.DB.prepare(
          "SELECT id FROM ticket_legs WHERE ticket_id = ?"
        )
          .bind(ticketId)
          .all<{ id: string }>();
        const ownedIds = new Set(ownedLegs.results.map((leg) => leg.id));
        if (
          input.legs.length !== ownedIds.size ||
          input.legs.some((leg) => !ownedIds.has(leg.id))
        ) {
          return c.json(
            {
              code: "INVALID_LEGS",
              error: "Settlement must include every ticket leg exactly once",
            },
            400
          );
        }
        const now = Date.now();
        const statuses = input.legs.map((leg) => leg.status);
        let ticketStatus: "lost" | "partially_void" | "push" | "won" = "won";
        if (statuses.includes("lost")) {
          ticketStatus = "lost";
        } else if (
          statuses.every((status) => status === "push" || status === "void")
        ) {
          ticketStatus = "push";
        } else if (statuses.includes("void") || statuses.includes("push")) {
          ticketStatus = "partially_void";
        }
        await env.DB.batch([
          ...input.legs.map((leg) =>
            env.DB.prepare(
              `UPDATE ticket_legs SET current_value = ?, lost_at = ?, settled_at = ?, status = ?, updated_at = ?, won_at = ?
           WHERE id = ? AND ticket_id = ?`
            ).bind(
              leg.value,
              leg.status === "lost" ? now : null,
              now,
              leg.status,
              now,
              leg.status === "won" ? now : null,
              leg.id,
              ticketId
            )
          ),
          env.DB.prepare(
            `UPDATE tickets SET result_source = ?, settled_at = ?, status = ?, updated_at = ?,
            verification_status = ?, verified_at = ?, version = version + 1 WHERE id = ? AND user_id = ?`
          ).bind(
            input.source,
            now,
            ticketStatus,
            now,
            input.source === "settled_slip"
              ? "partially_verified"
              : "unverified",
            input.source === "settled_slip" ? now : null,
            ticketId,
            user.id
          ),
          env.DB.prepare(
            "UPDATE tracking_subscriptions SET status = 'completed', updated_at = ? WHERE ticket_leg_id IN (SELECT id FROM ticket_legs WHERE ticket_id = ?)"
          ).bind(now, ticketId),
          env.DB.prepare(
            `INSERT INTO ticket_timeline_events (id, message, occurred_at, ticket_id, title, transition_key, type)
           VALUES (?, ?, ?, ?, 'Ticket manually settled', ?, 'ticket.manual_settlement')
           ON CONFLICT(transition_key) DO NOTHING`
          ).bind(
            crypto.randomUUID(),
            `Recorded from ${input.source}`,
            now,
            ticketId,
            `${ticketId}:manual-settlement:v1`
          ),
        ]);
        if (ticket.historical_import_batch_id) {
          await refreshHistoricalBatch(
            env.DB,
            ticket.historical_import_batch_id
          );
        }
        await writeAuditEvent({
          action: "ticket.manual_settlement",
          actorUserId: user.id,
          metadata: { source: input.source, status: ticketStatus },
          outcome: "success",
          request: c.req.raw,
          targetId: ticketId,
          targetType: "ticket",
        });
        return c.json({ ticket: await getTicket(ticketId, user.id) });
      }
    )
    .delete("/:ticketId", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const ticketId = c.req.param("ticketId");
      const result = await env.DB.prepare(
        "DELETE FROM tickets WHERE id = ? AND user_id = ? AND status IN ('draft', 'needs_review', 'void')"
      )
        .bind(ticketId, user.id)
        .run();
      if (result.meta.changes === 0) {
        return c.json(
          {
            code: "INVALID_STATE",
            error: "Only draft, review, or cancelled tickets can be deleted",
          },
          409
        );
      }
      await writeAuditEvent({
        action: "ticket.delete",
        actorUserId: user.id,
        outcome: "success",
        request: c.req.raw,
        targetId: ticketId,
        targetType: "ticket",
      });
      return c.body(null, 204);
    })
    .get("/:ticketId/timeline", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const rows = await env.DB.prepare(
        `SELECT e.id, e.message, e.metadata, e.occurred_at, e.ticket_leg_id,
          e.title, e.type FROM ticket_timeline_events e
         JOIN tickets t ON t.id = e.ticket_id
         WHERE e.ticket_id = ? AND t.user_id = ? ORDER BY e.occurred_at DESC`
      )
        .bind(c.req.param("ticketId"), user.id)
        .all<{
          id: string;
          message: string | null;
          metadata: string | null;
          occurred_at: number;
          ticket_leg_id: string | null;
          title: string;
          type: string;
        }>();
      return c.json({
        events: rows.results.map((row) => ({
          id: row.id,
          message: row.message,
          metadata: row.metadata
            ? (JSON.parse(row.metadata) as Record<string, unknown>)
            : null,
          occurredAt: new Date(row.occurred_at).toISOString(),
          ticketLegId: row.ticket_leg_id,
          title: row.title,
          type: row.type,
        })),
      });
    });
