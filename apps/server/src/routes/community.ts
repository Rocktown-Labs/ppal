import { zValidator } from "@hono/zod-validator";
import type { Auth } from "@ppal/auth";
import {
  createCommunityChannelRequestSchema,
  createCommunityReportRequestSchema,
  createCommunityRequestSchema,
  moderateCommunityMemberRequestSchema,
  resolveCommunityReportRequestSchema,
  updateCommunityChannelRequestSchema,
  updateCommunityRequestSchema,
  updateProfileRequestSchema,
} from "@ppal/contracts/community";
import { env } from "@ppal/env/server";
import { Hono } from "hono";
import type { Context } from "hono";
import StripeSdk from "stripe";
import { z } from "zod";

import { getAuthUser } from "../lib/auth";
import { escapeLikePattern } from "../lib/database";
import { matchesDeclaredMimeType } from "../lib/upload-security";
import { writeAuditEvent } from "../services/audit";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD = 64 * 1024;
const AVATAR_PATH_PART = /^[a-z0-9_.-]{1,160}$/iu;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const deviceTokenSchema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().trim().min(16).max(512),
});

const communityListLimit = (value: string | undefined): number => {
  const parsed = Number(value ?? 50);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 100) : 50;
};

const encodeCursor = (createdAt: number, id: string): string =>
  btoa(JSON.stringify({ createdAt, id }));

const decodeCursor = (
  value: string | undefined
): { createdAt: number; id: string } | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(atob(value));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof parsed.createdAt === "number" &&
      typeof parsed.id === "string"
    ) {
      return { createdAt: parsed.createdAt as number, id: parsed.id as string };
    }
  } catch {
    // Invalid cursors are treated as a fresh page.
  }
  return null;
};

interface CommunityRow {
  access: "free" | "paid";
  archived_at: number | null;
  description: string | null;
  id: string;
  name: string;
  owner_user_id: string;
  price_cents: number | null;
  rules: string | null;
  slug: string;
  visibility: "public" | "private";
}

interface MembershipRow {
  role: "owner" | "moderator" | "member";
  status: "active" | "pending" | "muted" | "banned";
}

const unauthorized = (c: Context): Response =>
  c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);

const creatorCanCreate = async (userId: string): Promise<boolean> => {
  const now = Date.now();
  const entitlement = await env.DB.prepare(
    `SELECT 1 AS eligible FROM billing_entitlements
     WHERE user_id = ? AND plan = 'creator'
       AND status IN ('active', 'trialing', 'grace_period')
       AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY updated_at DESC LIMIT 1`
  )
    .bind(userId, now)
    .first<{ eligible: number }>();
  return Boolean(entitlement);
};

const getCommunity = (slug: string): Promise<CommunityRow | null> =>
  env.DB.prepare(
    `SELECT access, archived_at, description, id, name, owner_user_id,
            price_cents, rules, slug, visibility
       FROM communities WHERE slug = ? AND archived_at IS NULL`
  )
    .bind(slug)
    .first<CommunityRow>();

const getMembership = (
  communityId: string,
  userId: string
): Promise<MembershipRow | null> =>
  env.DB.prepare(
    "SELECT role, status FROM community_members WHERE community_id = ? AND user_id = ?"
  )
    .bind(communityId, userId)
    .first<MembershipRow>();

const canViewCommunity = (
  community: CommunityRow,
  membership: MembershipRow | null
): boolean =>
  community.visibility === "public" || membership?.status === "active";

const isModerator = (membership: MembershipRow | null): boolean =>
  membership?.status === "active" &&
  (membership.role === "owner" || membership.role === "moderator");

const communityResponse = (community: CommunityRow) => ({
  access: community.access,
  description: community.description,
  id: community.id,
  name: community.name,
  ownerUserId: community.owner_user_id,
  priceCents: community.price_cents,
  rules: community.rules,
  slug: community.slug,
  visibility: community.visibility,
});

const stripeClient = (): StripeSdk | null => {
  const key = env.STRIPE_SECRET_KEY?.trim();
  return key ? new StripeSdk(key) : null;
};

const uploadAvatar = async (c: Context, auth: Auth): Promise<Response> => {
  const user = await getAuthUser(auth, c.req.raw.headers, {
    authoritative: true,
  });
  if (!user) {
    return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
  }
  const contentLength = Number(c.req.header("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_AVATAR_SIZE + MAX_MULTIPART_OVERHEAD
  ) {
    return c.json(
      { code: "AVATAR_TOO_LARGE", error: "Image size exceeds 5MB limit" },
      413
    );
  }
  const formData = await c.req.formData();
  const file = formData.get("avatar") ?? formData.get("file");
  if (!(file instanceof File)) {
    return c.json(
      { code: "AVATAR_REQUIRED", error: "Missing avatar file" },
      400
    );
  }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return c.json(
      {
        code: "INVALID_IMAGE_TYPE",
        error: "Invalid image type. Allowed: JPEG, PNG, WebP, GIF",
      },
      400
    );
  }
  if (file.size > MAX_AVATAR_SIZE) {
    return c.json(
      { code: "AVATAR_TOO_LARGE", error: "Image size exceeds 5MB limit" },
      413
    );
  }
  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!matchesDeclaredMimeType(signature, file.type)) {
    return c.json(
      {
        code: "INVALID_FILE_SIGNATURE",
        error: "Image contents do not match the declared type",
      },
      400
    );
  }
  const current = await env.DB.prepare(
    "SELECT avatar_object_key FROM profiles WHERE user_id = ?"
  )
    .bind(user.id)
    .first<{ avatar_object_key: string | null }>();
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const objectKey = `${user.id}/${filename}`;
  await env.R2_AVATARS.put(objectKey, file.stream(), {
    customMetadata: { ownerId: user.id },
    httpMetadata: { contentType: file.type },
  });
  const avatarPath = `/api/v1/avatar/${user.id}/${filename}`;
  const avatarUrl = new URL(avatarPath, env.BETTER_AUTH_URL).toString();
  const now = Date.now();
  const fallbackUsername =
    user.name?.toLowerCase().replaceAll(/[^a-z0-9_]/gu, "") ||
    `user_${user.id.slice(0, 8)}`;
  try {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE user SET image = ?, updated_at = ? WHERE id = ?"
      ).bind(avatarUrl, now, user.id),
      env.DB.prepare(
        `INSERT INTO profiles (avatar_object_key, updated_at, user_id, username)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           avatar_object_key = excluded.avatar_object_key,
           updated_at = excluded.updated_at`
      ).bind(objectKey, now, user.id, fallbackUsername),
    ]);
  } catch (error) {
    await env.R2_AVATARS.delete(objectKey);
    throw error;
  }
  if (current?.avatar_object_key && current.avatar_object_key !== objectKey) {
    const previousBucket = current.avatar_object_key.startsWith("avatars/")
      ? env.R2_UPLOADS
      : env.R2_AVATARS;
    await previousBucket.delete(current.avatar_object_key);
  }
  return c.json({ avatarObjectKey: objectKey, url: avatarUrl });
};

type UpdateProfileInput = z.infer<typeof updateProfileRequestSchema>;

export const getCurrentUserProfile = async (
  c: Context,
  auth: Auth
): Promise<Response> => {
  const user = await getAuthUser(auth, c.req.raw.headers, {
    authoritative: true,
  });
  if (!user) {
    return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
  }
  const profile = await env.DB.prepare(
    `SELECT bio, is_public, username FROM profiles WHERE user_id = ?`
  )
    .bind(user.id)
    .first<{ bio: string | null; is_public: number; username: string }>();
  return c.json({
    user: {
      ...user,
      profile: profile
        ? {
            bio: profile.bio,
            isPublic: profile.is_public === 1,
            username: profile.username,
          }
        : null,
    },
  });
};

export const updateCurrentUserProfile = async (
  c: Context,
  auth: Auth,
  input: UpdateProfileInput
): Promise<Response> => {
  const user = await getAuthUser(auth, c.req.raw.headers, {
    authoritative: true,
  });
  if (!user) {
    return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
  }
  const current = await env.DB.prepare(
    "SELECT bio, is_public, username FROM profiles WHERE user_id = ?"
  )
    .bind(user.id)
    .first<{ bio: string | null; is_public: number; username: string }>();
  const username = input.username ?? current?.username;
  if (!username) {
    return c.json(
      {
        code: "USERNAME_REQUIRED",
        error: "A username is required to create a profile",
      },
      400
    );
  }
  const now = Date.now();
  try {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE user SET name = COALESCE(?, name), updated_at = ? WHERE id = ?"
      ).bind(input.name ?? null, now, user.id),
      env.DB.prepare(
        `INSERT INTO profiles (bio, is_public, updated_at, user_id, username)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET bio = excluded.bio,
           is_public = excluded.is_public, updated_at = excluded.updated_at,
           username = excluded.username`
      ).bind(
        input.bio === undefined ? (current?.bio ?? null) : input.bio,
        input.isPublic === undefined
          ? (current?.is_public ?? 1)
          : Number(input.isPublic),
        now,
        user.id,
        username
      ),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return c.json(
        { code: "USERNAME_TAKEN", error: "Username is already taken" },
        409
      );
    }
    throw error;
  }
  await writeAuditEvent({
    action: "profile.update",
    actorUserId: user.id,
    outcome: "success",
    request: c.req.raw,
    targetId: user.id,
    targetType: "profile",
  });
  return c.json({ updated: true });
};

export const createCommunityRoutes = (auth: Auth) =>
  new Hono()
    .get("/me", (c) => getCurrentUserProfile(c, auth))
    .patch("/me", zValidator("json", updateProfileRequestSchema), (c) =>
      updateCurrentUserProfile(c, auth, c.req.valid("json"))
    )
    .post(
      "/me/device-tokens",
      zValidator("json", deviceTokenSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
        }
        const input = c.req.valid("json");
        const now = Date.now();
        const existingOwner = await env.DB.prepare(
          "SELECT user_id FROM device_tokens WHERE token = ?"
        )
          .bind(input.token)
          .first<{ user_id: string }>();
        if (existingOwner && existingOwner.user_id !== user.id) {
          return c.json(
            {
              code: "TOKEN_ALREADY_REGISTERED",
              error: "This device token belongs to another account",
            },
            409
          );
        }
        const tokenCount = await env.DB.prepare(
          "SELECT COUNT(*) AS count FROM device_tokens WHERE user_id = ?"
        )
          .bind(user.id)
          .first<{ count: number }>();
        if (!existingOwner && (tokenCount?.count ?? 0) >= 10) {
          return c.json(
            { code: "DEVICE_LIMIT", error: "Device token limit reached" },
            409
          );
        }
        await env.DB.prepare(
          `INSERT INTO device_tokens (id, last_seen_at, platform, token, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET last_seen_at = excluded.last_seen_at,
           platform = excluded.platform, updated_at = excluded.updated_at
           WHERE device_tokens.user_id = excluded.user_id`
        )
          .bind(
            crypto.randomUUID(),
            now,
            input.platform,
            input.token,
            now,
            user.id
          )
          .run();
        return c.json({ registered: true }, 201);
      }
    )
    .delete("/me/device-tokens", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const parsed = deviceTokenSchema
        .pick({ token: true })
        .safeParse(await c.req.json().catch(() => null));
      const token = parsed.success ? parsed.data.token : undefined;
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
    })
    .post("/me/avatar", (c) => uploadAvatar(c, auth))
    .post("/user/avatar", (c) => uploadAvatar(c, auth))
    .get("/avatar/:userId/:filename", async (c) => {
      const { userId, filename } = c.req.param();
      if (!(AVATAR_PATH_PART.test(userId) && AVATAR_PATH_PART.test(filename))) {
        return c.json({ code: "NOT_FOUND", error: "Avatar not found" }, 404);
      }
      const viewer = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      const owner = await env.DB.prepare(
        `SELECT avatar_object_key, is_public FROM profiles
         WHERE user_id = ? AND avatar_object_key IN (?, ?)`
      )
        .bind(userId, `${userId}/${filename}`, `avatars/${userId}/${filename}`)
        .first<{ avatar_object_key: string; is_public: number }>();
      if (!owner || (owner.is_public !== 1 && viewer?.id !== userId)) {
        return c.json({ code: "NOT_FOUND", error: "Avatar not found" }, 404);
      }
      const object = owner.avatar_object_key.startsWith("avatars/")
        ? await env.R2_UPLOADS.get(owner.avatar_object_key)
        : await env.R2_AVATARS.get(owner.avatar_object_key);
      if (!object) {
        return c.json({ code: "NOT_FOUND", error: "Avatar not found" }, 404);
      }
      const headers = new Headers({
        "cache-control":
          owner.is_public === 1 ? "public, max-age=3600" : "private, no-store",
        "content-disposition": `inline; filename="${filename}"`,
        "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
        "x-content-type-options": "nosniff",
      });
      if (object.httpEtag) {
        headers.set("etag", object.httpEtag);
      }
      return new Response(object.body, { headers });
    })
    .get("/profiles", async (c) => {
      const query = (c.req.query("q") ?? "").trim().toLowerCase();
      const pattern = `%${escapeLikePattern(query)}%`;
      const rows = await env.DB.prepare(
        `SELECT p.bio, p.username, u.image, u.name,
          (SELECT COUNT(*) FROM follows f WHERE f.followed_user_id = p.user_id) AS followers
         FROM profiles p JOIN user u ON u.id = p.user_id
         WHERE p.is_public = 1 AND (? = '' OR lower(p.username) LIKE ? ESCAPE '\\' OR lower(u.name) LIKE ? ESCAPE '\\')
         ORDER BY followers DESC, p.username LIMIT 50`
      )
        .bind(query, pattern, pattern)
        .all<{
          bio: string | null;
          followers: number;
          image: string | null;
          name: string;
          username: string;
        }>();
      return c.json({
        profiles: rows.results.map((profile) => ({
          avatarUrl: profile.image,
          bio: profile.bio,
          followerCount: profile.followers,
          name: profile.name,
          username: profile.username,
        })),
      });
    })
    .get("/profiles/:username", async (c) => {
      const profile = await env.DB.prepare(
        `SELECT p.bio, p.username, u.image, u.name,
          (SELECT COUNT(*) FROM follows f WHERE f.followed_user_id = p.user_id) AS followers,
          (SELECT COUNT(*) FROM tickets t WHERE t.user_id = p.user_id AND t.status = 'won'
            AND t.verification_status = 'verified') AS wins,
          (SELECT COUNT(*) FROM tickets t WHERE t.user_id = p.user_id AND t.status = 'lost'
            AND t.verification_status = 'verified') AS losses
         FROM profiles p JOIN user u ON u.id = p.user_id
         WHERE p.username = ? AND p.is_public = 1`
      )
        .bind(c.req.param("username"))
        .first<{
          bio: string | null;
          followers: number;
          image: string | null;
          losses: number;
          name: string;
          username: string;
          wins: number;
        }>();
      return profile
        ? c.json(
            {
              profile: {
                avatarUrl: profile.image,
                bio: profile.bio,
                followerCount: profile.followers,
                losses: profile.losses,
                name: profile.name,
                username: profile.username,
                wins: profile.wins,
              },
            },
            200
          )
        : c.json({ code: "NOT_FOUND", error: "Profile not found" }, 404);
    })
    .post("/profiles/:username/follow", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const followed = await env.DB.prepare(
        "SELECT user_id FROM profiles WHERE username = ? AND is_public = 1"
      )
        .bind(c.req.param("username"))
        .first<{ user_id: string }>();
      if (!followed) {
        return c.json({ code: "NOT_FOUND", error: "Profile not found" }, 404);
      }
      if (followed.user_id === user.id) {
        return c.json(
          { code: "SELF_FOLLOW", error: "You cannot follow yourself" },
          400
        );
      }
      await env.DB.prepare(
        `INSERT INTO follows (id, followed_user_id, follower_user_id)
         VALUES (?, ?, ?) ON CONFLICT(follower_user_id, followed_user_id) DO NOTHING`
      )
        .bind(crypto.randomUUID(), followed.user_id, user.id)
        .run();
      return c.json({ following: true });
    })
    .delete("/profiles/:username/follow", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      await env.DB.prepare(
        `DELETE FROM follows WHERE follower_user_id = ? AND followed_user_id =
         (SELECT user_id FROM profiles WHERE username = ?)`
      )
        .bind(user.id, c.req.param("username"))
        .run();
      return c.json({ following: false });
    })
    .get("/communities/public", async (c) => {
      const limit = communityListLimit(c.req.query("limit"));
      const rows = await env.DB.prepare(
        `SELECT access, description, id, name, owner_user_id, price_cents,
                rules, slug, visibility
           FROM communities
          WHERE visibility = 'public' AND archived_at IS NULL
          ORDER BY created_at DESC LIMIT ?`
      )
        .bind(limit)
        .all<CommunityRow>();
      return c.json({ communities: rows.results.map(communityResponse) });
    })
    .get("/communities", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return unauthorized(c);
      }
      const rows = await env.DB.prepare(
        `SELECT c.access, c.description, c.id, c.name, c.owner_user_id,
                c.price_cents, c.rules, c.slug, c.visibility, m.role, m.status
           FROM communities c
           JOIN community_members m ON m.community_id = c.id
          WHERE m.user_id = ? AND c.archived_at IS NULL
          ORDER BY c.created_at DESC`
      )
        .bind(user.id)
        .all<CommunityRow & MembershipRow>();
      return c.json({
        communities: rows.results.map((row) => ({
          ...communityResponse(row),
          membership: { role: row.role, status: row.status },
        })),
      });
    })
    .get("/communities/:slug", async (c) => {
      const community = await getCommunity(c.req.param("slug"));
      if (!community) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      const membership = user
        ? await getMembership(community.id, user.id)
        : null;
      if (!canViewCommunity(community, membership)) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const channels = await env.DB.prepare(
        `SELECT description, id, is_archived, is_default, name, position, slug
           FROM community_channels
          WHERE community_id = ? AND is_archived = 0
          ORDER BY position, created_at`
      )
        .bind(community.id)
        .all<{
          description: string | null;
          id: string;
          is_archived: number;
          is_default: number;
          name: string;
          position: number;
          slug: string;
        }>();
      return c.json({
        channels: channels.results.map((channel) => ({
          description: channel.description,
          id: channel.id,
          isDefault: channel.is_default === 1,
          name: channel.name,
          position: channel.position,
          slug: channel.slug,
        })),
        community: communityResponse(community),
        membership: membership
          ? { role: membership.role, status: membership.status }
          : null,
      });
    })
    .post(
      "/communities",
      zValidator("json", createCommunityRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return unauthorized(c);
        }
        if (!(await creatorCanCreate(user.id))) {
          return c.json(
            {
              code: "CREATOR_REQUIRED",
              error: "An active Creator plan is required to create a community",
            },
            403
          );
        }
        const input = c.req.valid("json");
        if (input.access === "paid" && !input.priceCents) {
          return c.json(
            {
              code: "PRICE_REQUIRED",
              error: "Paid communities require a price",
            },
            400
          );
        }
        const id = crypto.randomUUID();
        const channelId = crypto.randomUUID();
        const now = Date.now();
        try {
          await env.DB.batch([
            env.DB.prepare(
              `INSERT INTO communities (access, created_at, description, id, name,
                 owner_user_id, price_cents, rules, slug, updated_at, visibility)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              input.access,
              now,
              input.description ?? null,
              id,
              input.name,
              user.id,
              input.access === "paid" ? input.priceCents : null,
              input.rules ?? null,
              input.slug,
              now,
              input.visibility
            ),
            env.DB.prepare(
              `INSERT INTO community_members (community_id, joined_at, role, status, updated_at, user_id)
               VALUES (?, ?, 'owner', 'active', ?, ?)`
            ).bind(id, now, now, user.id),
            env.DB.prepare(
              `INSERT INTO community_channels
                 (community_id, created_at, id, is_default, name, position, slug, updated_at)
               VALUES (?, ?, ?, 1, 'General', 0, 'general', ?)`
            ).bind(id, now, channelId, now),
          ]);
        } catch (error) {
          if (error instanceof Error && /unique/iu.test(error.message)) {
            return c.json(
              {
                code: "SLUG_TAKEN",
                error: "That community URL is already in use",
              },
              409
            );
          }
          throw error;
        }
        return c.json(
          {
            community: {
              ...communityResponse({
                ...input,
                access: input.access,
                archived_at: null,
                description: input.description ?? null,
                id,
                name: input.name,
                owner_user_id: user.id,
                price_cents:
                  input.access === "paid" ? (input.priceCents ?? null) : null,
                rules: input.rules ?? null,
                slug: input.slug,
                visibility: input.visibility,
              }),
              membership: { role: "owner", status: "active" },
            },
          },
          201
        );
      }
    )
    .patch(
      "/communities/:slug",
      zValidator("json", updateCommunityRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return unauthorized(c);
        }
        const community = await getCommunity(c.req.param("slug"));
        if (!community) {
          return c.json(
            { code: "NOT_FOUND", error: "Community not found" },
            404
          );
        }
        const membership = await getMembership(community.id, user.id);
        if (membership?.role !== "owner") {
          return c.json(
            {
              code: "FORBIDDEN",
              error: "Only the owner can edit this community",
            },
            403
          );
        }
        const input = c.req.valid("json");
        const access = input.access ?? community.access;
        const priceCents =
          input.priceCents === undefined
            ? community.price_cents
            : input.priceCents;
        if (access === "paid" && !priceCents) {
          return c.json(
            {
              code: "PRICE_REQUIRED",
              error: "Paid communities require a price",
            },
            400
          );
        }
        const now = Date.now();
        try {
          await env.DB.prepare(
            `UPDATE communities SET access = ?, description = ?, name = ?, price_cents = ?,
             rules = ?, slug = ?, updated_at = ?, visibility = ? WHERE id = ?`
          )
            .bind(
              access,
              input.description === undefined
                ? community.description
                : input.description,
              input.name ?? community.name,
              access === "paid" ? priceCents : null,
              input.rules === undefined ? community.rules : input.rules,
              input.slug ?? community.slug,
              now,
              input.visibility ?? community.visibility,
              community.id
            )
            .run();
        } catch (error) {
          if (error instanceof Error && /unique/iu.test(error.message)) {
            return c.json(
              {
                code: "SLUG_TAKEN",
                error: "That community URL is already in use",
              },
              409
            );
          }
          throw error;
        }
        const updated = await getCommunity(input.slug ?? community.slug);
        return c.json({
          community: updated
            ? communityResponse(updated)
            : communityResponse(community),
        });
      }
    )
    .post(
      "/communities/:slug/channels",
      zValidator("json", createCommunityChannelRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return unauthorized(c);
        }
        const community = await getCommunity(c.req.param("slug"));
        if (!community) {
          return c.json(
            { code: "NOT_FOUND", error: "Community not found" },
            404
          );
        }
        const membership = await getMembership(community.id, user.id);
        if (!isModerator(membership)) {
          return c.json(
            { code: "FORBIDDEN", error: "Moderator access required" },
            403
          );
        }
        const input = c.req.valid("json");
        const now = Date.now();
        const maxPosition = await env.DB.prepare(
          "SELECT COALESCE(MAX(position), -1) AS position FROM community_channels WHERE community_id = ?"
        )
          .bind(community.id)
          .first<{ position: number }>();
        const id = crypto.randomUUID();
        try {
          await env.DB.prepare(
            `INSERT INTO community_channels (community_id, created_at, description, id, name, position, slug, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              community.id,
              now,
              input.description ?? null,
              id,
              input.name,
              (maxPosition?.position ?? -1) + 1,
              input.slug,
              now
            )
            .run();
        } catch (error) {
          if (error instanceof Error && /unique/iu.test(error.message)) {
            return c.json(
              {
                code: "SLUG_TAKEN",
                error: "That channel URL is already in use",
              },
              409
            );
          }
          throw error;
        }
        return c.json(
          {
            channel: {
              description: input.description ?? null,
              id,
              isDefault: false,
              name: input.name,
              position: (maxPosition?.position ?? -1) + 1,
              slug: input.slug,
            },
          },
          201
        );
      }
    )
    .patch(
      "/communities/:slug/channels/:channelId",
      zValidator("json", updateCommunityChannelRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return unauthorized(c);
        }
        const community = await getCommunity(c.req.param("slug"));
        if (!community) {
          return c.json(
            { code: "NOT_FOUND", error: "Community not found" },
            404
          );
        }
        const membership = await getMembership(community.id, user.id);
        if (!isModerator(membership)) {
          return c.json(
            { code: "FORBIDDEN", error: "Moderator access required" },
            403
          );
        }
        const input = c.req.valid("json");
        const result = await env.DB.prepare(
          `UPDATE community_channels SET description = COALESCE(?, description),
             name = COALESCE(?, name), slug = COALESCE(?, slug), updated_at = ?
           WHERE id = ? AND community_id = ? AND is_archived = 0`
        )
          .bind(
            input.description ?? null,
            input.name ?? null,
            input.slug ?? null,
            Date.now(),
            c.req.param("channelId"),
            community.id
          )
          .run();
        if (result.meta.changes === 0) {
          return c.json({ code: "NOT_FOUND", error: "Channel not found" }, 404);
        }
        return c.json({ updated: true });
      }
    )
    .delete("/communities/:slug/channels/:channelId", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return unauthorized(c);
      }
      const community = await getCommunity(c.req.param("slug"));
      if (!community) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const membership = await getMembership(community.id, user.id);
      if (!isModerator(membership)) {
        return c.json(
          { code: "FORBIDDEN", error: "Moderator access required" },
          403
        );
      }
      const channel = await env.DB.prepare(
        "SELECT is_default FROM community_channels WHERE id = ? AND community_id = ?"
      )
        .bind(c.req.param("channelId"), community.id)
        .first<{ is_default: number }>();
      if (!channel) {
        return c.json({ code: "NOT_FOUND", error: "Channel not found" }, 404);
      }
      if (channel.is_default === 1) {
        return c.json(
          {
            code: "DEFAULT_CHANNEL",
            error: "The General channel cannot be archived",
          },
          400
        );
      }
      await env.DB.prepare(
        "UPDATE community_channels SET is_archived = 1, updated_at = ? WHERE id = ?"
      )
        .bind(Date.now(), c.req.param("channelId"))
        .run();
      return c.json({ archived: true });
    })
    .post("/communities/:slug/join", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return unauthorized(c);
      }
      const community = await getCommunity(c.req.param("slug"));
      if (!community) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const existing = await getMembership(community.id, user.id);
      if (existing) {
        return c.json({ membership: existing });
      }
      if (community.access === "paid") {
        const stripe = stripeClient();
        if (!stripe) {
          return c.json(
            {
              code: "PAYMENTS_UNAVAILABLE",
              error: "Paid community checkout is not configured",
            },
            503
          );
        }
        const webOrigin = env.CORS_ORIGIN.replace(/\/$/u, "");
        const session = await stripe.checkout.sessions.create({
          cancel_url: `${webOrigin}/communities/${community.slug}?checkout=cancelled`,
          client_reference_id: user.id,
          customer_email: user.email,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: { name: `${community.name} membership` },
                unit_amount: community.price_cents ?? 0,
              },
              quantity: 1,
            },
          ],
          metadata: { communityId: community.id, userId: user.id },
          mode: "payment",
          success_url: `${webOrigin}/communities/${community.slug}?checkout_session_id={CHECKOUT_SESSION_ID}`,
          ...(env.STRIPE_TAX_ENABLED === "true"
            ? {
                automatic_tax: { enabled: true },
                customer_update: { address: "auto" as const },
              }
            : {}),
        });
        return c.json({ checkoutUrl: session.url });
      }
      const status = community.visibility === "private" ? "pending" : "active";
      await env.DB.prepare(
        `INSERT INTO community_members (community_id, joined_at, role, status, updated_at, user_id)
         VALUES (?, ?, 'member', ?, ?, ?)
         ON CONFLICT(community_id, user_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`
      )
        .bind(community.id, Date.now(), status, Date.now(), user.id)
        .run();
      return c.json({ membership: { role: "member", status } }, 201);
    })
    .post("/communities/:slug/join/complete", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return unauthorized(c);
      }
      const body = (await c.req.json().catch(() => null)) as {
        sessionId?: unknown;
      } | null;
      if (
        !body ||
        typeof body.sessionId !== "string" ||
        body.sessionId.length > 10_000
      ) {
        return c.json(
          {
            code: "INVALID_SESSION",
            error: "A checkout session id is required",
          },
          400
        );
      }
      const community = await getCommunity(c.req.param("slug"));
      const stripe = stripeClient();
      if (!community || community.access !== "paid") {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      if (!stripe) {
        return c.json(
          {
            code: "PAYMENTS_UNAVAILABLE",
            error: "Paid community checkout is not configured",
          },
          503
        );
      }
      const session = await stripe.checkout.sessions.retrieve(body.sessionId);
      if (
        session.payment_status !== "paid" ||
        session.status !== "complete" ||
        session.metadata?.communityId !== community.id ||
        session.metadata?.userId !== user.id
      ) {
        return c.json(
          {
            code: "PAYMENT_NOT_VERIFIED",
            error: "Payment could not be verified",
          },
          402
        );
      }
      await env.DB.prepare(
        `INSERT INTO community_members (community_id, joined_at, paid_at, payment_reference, role, status, updated_at, user_id)
         VALUES (?, ?, ?, ?, 'member', 'active', ?, ?)
         ON CONFLICT(community_id, user_id) DO UPDATE SET paid_at = excluded.paid_at, payment_reference = excluded.payment_reference, status = 'active', updated_at = excluded.updated_at`
      )
        .bind(
          community.id,
          Date.now(),
          Date.now(),
          session.id,
          Date.now(),
          user.id
        )
        .run();
      return c.json({ membership: { role: "member", status: "active" } });
    })
    .delete("/communities/:slug/membership", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return unauthorized(c);
      }
      const community = await getCommunity(c.req.param("slug"));
      if (!community) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const membership = await getMembership(community.id, user.id);
      if (membership?.role === "owner") {
        return c.json(
          {
            code: "OWNER_CANNOT_LEAVE",
            error: "Transfer ownership before leaving",
          },
          400
        );
      }
      await env.DB.prepare(
        "DELETE FROM community_members WHERE community_id = ? AND user_id = ?"
      )
        .bind(community.id, user.id)
        .run();
      return c.json({ left: true });
    })
    .get("/communities/:slug/channels/:channelId/messages", async (c) => {
      const community = await getCommunity(c.req.param("slug"));
      if (!community) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      const membership = user
        ? await getMembership(community.id, user.id)
        : null;
      if (!canViewCommunity(community, membership)) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const channel = await env.DB.prepare(
        "SELECT id FROM community_channels WHERE id = ? AND community_id = ? AND is_archived = 0"
      )
        .bind(c.req.param("channelId"), community.id)
        .first<{ id: string }>();
      if (!channel) {
        return c.json({ code: "NOT_FOUND", error: "Channel not found" }, 404);
      }
      const limit = communityListLimit(c.req.query("limit"));
      const cursor = decodeCursor(c.req.query("cursor"));
      const query = cursor
        ? `SELECT m.author_user_id, m.body, m.created_at, m.deleted_at, m.edited_at, m.id,
                  m.mentions, m.reply_to_id, u.image, u.name, p.username
             FROM community_messages m JOIN user u ON u.id = m.author_user_id
             LEFT JOIN profiles p ON p.user_id = m.author_user_id
            WHERE m.channel_id = ? AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))
            ORDER BY m.created_at DESC, m.id DESC LIMIT ?`
        : `SELECT m.author_user_id, m.body, m.created_at, m.deleted_at, m.edited_at, m.id,
                  m.mentions, m.reply_to_id, u.image, u.name, p.username
             FROM community_messages m JOIN user u ON u.id = m.author_user_id
             LEFT JOIN profiles p ON p.user_id = m.author_user_id
            WHERE m.channel_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT ?`;
      const statement = cursor
        ? env.DB.prepare(query).bind(
            channel.id,
            cursor.createdAt,
            cursor.createdAt,
            cursor.id,
            limit + 1
          )
        : env.DB.prepare(query).bind(channel.id, limit + 1);
      const rows = await statement.all<{
        author_user_id: string;
        body: string;
        created_at: number;
        deleted_at: number | null;
        edited_at: number | null;
        id: string;
        image: string | null;
        mentions: string;
        name: string;
        pusername: string | null;
        reply_to_id: string | null;
      }>();
      const hasMore = rows.results.length > limit;
      const page = rows.results.slice(0, limit);
      return c.json({
        messages: page.toReversed().map((row) => ({
          author: {
            avatarUrl: row.image,
            name: row.name,
            username: row.pusername,
          },
          body: row.deleted_at ? "This message was deleted" : row.body,
          createdAt: new Date(row.created_at).toISOString(),
          deletedAt: row.deleted_at
            ? new Date(row.deleted_at).toISOString()
            : null,
          editedAt: row.edited_at
            ? new Date(row.edited_at).toISOString()
            : null,
          id: row.id,
          mentions: JSON.parse(row.mentions) as string[],
          replyToId: row.reply_to_id,
        })),
        nextCursor:
          hasMore && page.length > 0
            ? encodeCursor(page.at(-1)?.created_at ?? 0, page.at(-1)?.id ?? "")
            : null,
      });
    })
    .get("/communities/:slug/channels/:channelId/ws", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return unauthorized(c);
      }
      const community = await getCommunity(c.req.param("slug"));
      if (!community) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const membership = await getMembership(community.id, user.id);
      if (membership?.status !== "active") {
        return c.json(
          { code: "FORBIDDEN", error: "Join the community to chat" },
          403
        );
      }
      const channel = await env.DB.prepare(
        "SELECT id FROM community_channels WHERE id = ? AND community_id = ? AND is_archived = 0"
      )
        .bind(c.req.param("channelId"), community.id)
        .first<{ id: string }>();
      if (!channel) {
        return c.json({ code: "NOT_FOUND", error: "Channel not found" }, 404);
      }
      if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
        return c.json(
          { code: "UPGRADE_REQUIRED", error: "WebSocket upgrade required" },
          426
        );
      }
      const stub = env.COMMUNITY_CHANNEL_ROOMS.getByName(
        `${community.id}:${channel.id}`
      );
      const headers = new Headers(c.req.raw.headers);
      headers.set("x-ppal-user-id", user.id);
      headers.set("x-ppal-community-id", community.id);
      headers.set("x-ppal-channel-id", channel.id);
      headers.set("x-ppal-community-role", membership.role);
      return stub.fetch(new Request(c.req.raw.url, { headers, method: "GET" }));
    })
    .get("/communities/:slug/members", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return unauthorized(c);
      }
      const community = await getCommunity(c.req.param("slug"));
      if (!community) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const membership = await getMembership(community.id, user.id);
      if (!isModerator(membership)) {
        return c.json(
          { code: "FORBIDDEN", error: "Moderator access required" },
          403
        );
      }
      const rows = await env.DB.prepare(
        `SELECT m.role, m.status, m.joined_at, u.id, u.image, u.name, u.email, p.username
           FROM community_members m JOIN user u ON u.id = m.user_id
           LEFT JOIN profiles p ON p.user_id = m.user_id
          WHERE m.community_id = ? ORDER BY m.joined_at`
      )
        .bind(community.id)
        .all<{
          email: string;
          id: string;
          image: string | null;
          joined_at: number;
          name: string;
          pusername: string | null;
          role: string;
          status: string;
        }>();
      return c.json({
        members: rows.results.map((row) => ({
          joinedAt: new Date(row.joined_at).toISOString(),
          role: row.role,
          status: row.status,
          user: {
            email: row.email,
            id: row.id,
            image: row.image,
            name: row.name,
            username: row.pusername,
          },
        })),
      });
    })
    .patch(
      "/communities/:slug/members/:userId",
      zValidator("json", moderateCommunityMemberRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return unauthorized(c);
        }
        const community = await getCommunity(c.req.param("slug"));
        if (!community) {
          return c.json(
            { code: "NOT_FOUND", error: "Community not found" },
            404
          );
        }
        const actor = await getMembership(community.id, user.id);
        const target = await getMembership(community.id, c.req.param("userId"));
        if (
          !isModerator(actor) ||
          !target ||
          target.role === "owner" ||
          (actor?.role === "moderator" && target.role === "moderator")
        ) {
          return c.json(
            { code: "FORBIDDEN", error: "You cannot moderate this member" },
            403
          );
        }
        const input = c.req.valid("json");
        await env.DB.prepare(
          "UPDATE community_members SET role = COALESCE(?, role), status = COALESCE(?, status), updated_at = ? WHERE community_id = ? AND user_id = ?"
        )
          .bind(
            input.role ?? null,
            input.status ?? null,
            Date.now(),
            community.id,
            c.req.param("userId")
          )
          .run();
        return c.json({ updated: true });
      }
    )
    .post(
      "/communities/:slug/channels/:channelId/messages/:messageId/report",
      zValidator("json", createCommunityReportRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return unauthorized(c);
        }
        const community = await getCommunity(c.req.param("slug"));
        if (!community) {
          return c.json(
            { code: "NOT_FOUND", error: "Community not found" },
            404
          );
        }
        const membership = await getMembership(community.id, user.id);
        if (membership?.status !== "active") {
          return c.json(
            {
              code: "FORBIDDEN",
              error: "Join the community to report messages",
            },
            403
          );
        }
        const message = await env.DB.prepare(
          "SELECT 1 AS present FROM community_messages WHERE id = ? AND community_id = ? AND channel_id = ?"
        )
          .bind(
            c.req.param("messageId"),
            community.id,
            c.req.param("channelId")
          )
          .first<{ present: number }>();
        if (!message) {
          return c.json({ code: "NOT_FOUND", error: "Message not found" }, 404);
        }
        const input = c.req.valid("json");
        try {
          await env.DB.prepare(
            "INSERT INTO community_reports (community_id, created_at, id, message_id, reason, reporter_user_id, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)"
          )
            .bind(
              community.id,
              Date.now(),
              crypto.randomUUID(),
              c.req.param("messageId"),
              input.reason,
              user.id,
              Date.now()
            )
            .run();
        } catch (error) {
          if (error instanceof Error && /unique/iu.test(error.message)) {
            return c.json(
              {
                code: "ALREADY_REPORTED",
                error: "You already reported this message",
              },
              409
            );
          }
          throw error;
        }
        return c.json({ reported: true }, 201);
      }
    )
    .get("/communities/:slug/reports", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers, {
        authoritative: true,
      });
      if (!user) {
        return unauthorized(c);
      }
      const community = await getCommunity(c.req.param("slug"));
      if (!community) {
        return c.json({ code: "NOT_FOUND", error: "Community not found" }, 404);
      }
      const membership = await getMembership(community.id, user.id);
      if (!isModerator(membership)) {
        return c.json(
          { code: "FORBIDDEN", error: "Moderator access required" },
          403
        );
      }
      const rows = await env.DB.prepare(
        "SELECT created_at, id, message_id, reason, reporter_user_id, resolved_at, status FROM community_reports WHERE community_id = ? ORDER BY created_at DESC LIMIT 100"
      )
        .bind(community.id)
        .all<{
          created_at: number;
          id: string;
          message_id: string;
          reason: string;
          reporter_user_id: string;
          resolved_at: number | null;
          status: string;
        }>();
      return c.json({
        reports: rows.results.map((row) => ({
          createdAt: new Date(row.created_at).toISOString(),
          id: row.id,
          messageId: row.message_id,
          reason: row.reason,
          reporterUserId: row.reporter_user_id,
          resolvedAt: row.resolved_at
            ? new Date(row.resolved_at).toISOString()
            : null,
          status: row.status,
        })),
      });
    })
    .patch(
      "/communities/:slug/reports/:reportId",
      zValidator("json", resolveCommunityReportRequestSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return unauthorized(c);
        }
        const community = await getCommunity(c.req.param("slug"));
        if (!community) {
          return c.json(
            { code: "NOT_FOUND", error: "Community not found" },
            404
          );
        }
        const membership = await getMembership(community.id, user.id);
        if (!isModerator(membership)) {
          return c.json(
            { code: "FORBIDDEN", error: "Moderator access required" },
            403
          );
        }
        const input = c.req.valid("json");
        const result = await env.DB.prepare(
          "UPDATE community_reports SET resolved_at = ?, resolved_by = ?, status = ?, updated_at = ? WHERE id = ? AND community_id = ?"
        )
          .bind(
            Date.now(),
            user.id,
            input.status,
            Date.now(),
            c.req.param("reportId"),
            community.id
          )
          .run();
        if (result.meta.changes === 0) {
          return c.json({ code: "NOT_FOUND", error: "Report not found" }, 404);
        }
        return c.json({ updated: true });
      }
    )
    .delete(
      "/communities/:slug/channels/:channelId/messages/:messageId",
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers, {
          authoritative: true,
        });
        if (!user) {
          return unauthorized(c);
        }
        const community = await getCommunity(c.req.param("slug"));
        if (!community) {
          return c.json(
            { code: "NOT_FOUND", error: "Community not found" },
            404
          );
        }
        const membership = await getMembership(community.id, user.id);
        const message = await env.DB.prepare(
          "SELECT author_user_id FROM community_messages WHERE id = ? AND community_id = ? AND channel_id = ? AND deleted_at IS NULL"
        )
          .bind(
            c.req.param("messageId"),
            community.id,
            c.req.param("channelId")
          )
          .first<{ author_user_id: string }>();
        if (!message) {
          return c.json({ code: "NOT_FOUND", error: "Message not found" }, 404);
        }
        if (message.author_user_id !== user.id && !isModerator(membership)) {
          return c.json(
            { code: "FORBIDDEN", error: "You cannot delete this message" },
            403
          );
        }
        await env.DB.prepare(
          "UPDATE community_messages SET body = '', deleted_at = ? WHERE id = ?"
        )
          .bind(Date.now(), c.req.param("messageId"))
          .run();
        const stub = env.COMMUNITY_CHANNEL_ROOMS.getByName(
          `${community.id}:${c.req.param("channelId")}`
        );
        await stub.fetch(
          new Request("https://internal/events", {
            body: JSON.stringify({
              messageId: c.req.param("messageId"),
              type: "delete",
            }),
            headers: {
              "content-type": "application/json",
              "x-ppal-internal": "1",
            },
            method: "POST",
          })
        );
        return c.json({ deleted: true });
      }
    );
