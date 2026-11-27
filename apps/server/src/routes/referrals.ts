import type { Auth } from "@ppal/auth";
import type { SqlDatabase } from "@ppal/db";
/* oxlint-disable no-await-in-loop -- Referral-code collision retries must observe each unique constraint result. */
import { Hono } from "hono";

import { getAuthUser } from "../lib/auth";
import { getDb } from "../lib/database";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

interface ReferralRow {
  claimed_at: number | null;
  code: string;
  completed_at: number | null;
  created_at: number;
  id: string;
  status: "pending" | "completed" | "expired" | "cancelled";
}

const mapReferral = (row: ReferralRow) => ({
  claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
  code: row.code,
  completedAt: row.completed_at
    ? new Date(row.completed_at).toISOString()
    : null,
  createdAt: new Date(row.created_at).toISOString(),
  id: row.id,
  status: row.status,
});

const randomCode = (): string => {
  const maxUnbiased =
    Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  const chars: string[] = [];
  while (chars.length < CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2));
    for (const byte of bytes) {
      if (byte < maxUnbiased) {
        const char = CODE_ALPHABET[byte % CODE_ALPHABET.length];
        if (char) {
          chars.push(char);
        }
        if (chars.length === CODE_LENGTH) {
          break;
        }
      }
    }
  }
  return chars.join("");
};

const ensureReferralCode = async (userId: string): Promise<string> => {
  const current = await getDb()
    .prepare("SELECT referral_code FROM user WHERE id = ?")
    .bind(userId)
    .first<{ referral_code: string | null }>();
  if (current?.referral_code) {
    return current.referral_code;
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    try {
      const result = await getDb()
        .prepare(
          "UPDATE user SET referral_code = ?, updated_at = ? WHERE id = ? AND referral_code IS NULL RETURNING referral_code"
        )
        .bind(code, new Date(), userId)
        .first<{ referral_code: string }>();
      if (result?.referral_code) {
        return result.referral_code;
      }
      const raced = await getDb()
        .prepare("SELECT referral_code FROM user WHERE id = ?")
        .bind(userId)
        .first<{ referral_code: string | null }>();
      if (raced?.referral_code) {
        return raced.referral_code;
      }
    } catch (error) {
      const isUniqueViolation =
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === "23505") ||
        (error instanceof Error &&
          /unique|duplicate key/iu.test(error.message));
      if (!isUniqueViolation) {
        throw error;
      }
    }
  }
  throw new Error("Could not generate a unique referral code");
};

export const createReferralRoutes = (auth: Auth) =>
  new Hono()
    .get("/referrals", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const code = await ensureReferralCode(user.id);
      const rows = await getDb()
        .prepare(
          `SELECT claimed_at, code, completed_at, created_at, id, status FROM referrals
         WHERE referrer_user_id = ? ORDER BY created_at DESC LIMIT 100`
        )
        .bind(user.id)
        .all<ReferralRow>();
      const completed = rows.results.filter(
        (row) => row.status === "completed"
      ).length;
      return c.json({
        code,
        referrals: rows.results.map(mapReferral),
        shareUrl: `https://myparlaypal.com/r/${code}`,
        summary: {
          completed,
          pending: rows.results.length - completed,
          total: rows.results.length,
        },
      });
    })
    .post("/referrals", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const code = await ensureReferralCode(user.id);
      return c.json({
        code,
        shareUrl: `https://myparlaypal.com/r/${code}`,
      });
    })
    .get("/referrals/:code", async (c) => {
      const code = c.req.param("code").trim().toUpperCase();
      const owner = await getDb()
        .prepare("SELECT id FROM user WHERE referral_code = ?")
        .bind(code)
        .first<{ id: string }>();
      return owner
        ? c.json({
            referral: { available: true, code },
          })
        : c.json({ code: "NOT_FOUND", error: "Referral not found" }, 404);
    })
    .post("/referrals/:code/claim", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const code = c.req.param("code").trim().toUpperCase();
      const referralId = crypto.randomUUID();
      const result = await getDb()
        .prepare(
          `INSERT INTO referrals (claimed_at, code, id, referred_user_id, referrer_user_id, status)
         SELECT ?, u.referral_code, ?, ?, u.id, 'pending' FROM user u
         WHERE u.referral_code = ? AND u.id != ?
           AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.referred_user_id = ?)
         ON CONFLICT(referred_user_id) DO NOTHING`
        )
        .bind(Date.now(), referralId, user.id, code, user.id, user.id)
        .run();
      if (result.meta.changes === 0) {
        return c.json(
          {
            code: "NOT_CLAIMABLE",
            error: "Referral is invalid, already claimed, or belongs to you",
          },
          409
        );
      }
      return c.json({ claimed: true, referralId }, 201);
    });

export const qualifyReferral = async (
  db: SqlDatabase,
  referredUserId: string
): Promise<void> => {
  await db
    .prepare(
      `UPDATE referrals SET completed_at = ?, status = 'completed'
       WHERE referred_user_id = ? AND status = 'pending'`
    )
    .bind(Date.now(), referredUserId)
    .run();
};
