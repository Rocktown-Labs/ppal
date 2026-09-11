import { zValidator } from "@hono/zod-validator";
import type { Auth } from "@ppal/auth";
import { updateProfileRequestSchema } from "@ppal/contracts/community";
import { env } from "@ppal/env/server";
import { Hono } from "hono";
import { z } from "zod";

import { getAuthUser } from "../lib/auth";
import { writeAuditEvent } from "../services/audit";

const deviceTokenSchema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z.string().trim().min(16).max(512),
});

export const createCommunityRoutes = (auth: Auth) =>
  new Hono()
    .get("/me", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
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
    })
    .patch("/me", zValidator("json", updateProfileRequestSchema), async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const input = c.req.valid("json");
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
    })
    .post(
      "/me/device-tokens",
      zValidator("json", deviceTokenSchema),
      async (c) => {
        const user = await getAuthUser(auth, c.req.raw.headers);
        if (!user) {
          return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
        }
        const input = c.req.valid("json");
        const now = Date.now();
        await env.DB.prepare(
          `INSERT INTO device_tokens (id, last_seen_at, platform, token, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET last_seen_at = excluded.last_seen_at,
           platform = excluded.platform, updated_at = excluded.updated_at,
           user_id = excluded.user_id`
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
    })
    .post("/me/avatar", async (c) => {
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const formData = await c.req.formData();
      const file = formData.get("avatar") ?? formData.get("file");
      if (!file || !(file instanceof File)) {
        return c.json(
          { code: "AVATAR_REQUIRED", error: "Missing avatar file" },
          400
        );
      }
      const allowedTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ]);
      if (!allowedTypes.has(file.type)) {
        return c.json(
          {
            code: "INVALID_IMAGE_TYPE",
            error: "Invalid image type. Allowed: JPEG, PNG, WebP, GIF",
          },
          400
        );
      }
      if (file.size > 5 * 1024 * 1024) {
        return c.json(
          { code: "AVATAR_TOO_LARGE", error: "Image size exceeds 5MB limit" },
          400
        );
      }
      const ext = file.type.split("/")[1] ?? "jpg";
      const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const objectKey = `avatars/${user.id}/${filename}`;

      await env.R2_UPLOADS.put(objectKey, file.stream(), {
        httpMetadata: {
          contentType: file.type,
        },
      });

      const avatarUrl = `/api/v1/avatar/${user.id}/${filename}`;
      const now = Date.now();
      const fallbackUsername =
        user.name?.toLowerCase().replaceAll(/[^a-z0-9_]/gu, "") ||
        `user_${user.id.slice(0, 8)}`;

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

      return c.json({ avatarObjectKey: objectKey, url: avatarUrl });
    })
    .post("/user/avatar", async (c) => {
      // Direct alias for /me/avatar
      const user = await getAuthUser(auth, c.req.raw.headers);
      if (!user) {
        return c.json({ code: "UNAUTHORIZED", error: "Unauthorized" }, 401);
      }
      const formData = await c.req.formData();
      const file = formData.get("avatar") ?? formData.get("file");
      if (!file || !(file instanceof File)) {
        return c.json(
          { code: "AVATAR_REQUIRED", error: "Missing avatar file" },
          400
        );
      }
      const allowedTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ]);
      if (!allowedTypes.has(file.type)) {
        return c.json(
          {
            code: "INVALID_IMAGE_TYPE",
            error: "Invalid image type. Allowed: JPEG, PNG, WebP, GIF",
          },
          400
        );
      }
      if (file.size > 5 * 1024 * 1024) {
        return c.json(
          { code: "AVATAR_TOO_LARGE", error: "Image size exceeds 5MB limit" },
          400
        );
      }
      const ext = file.type.split("/")[1] ?? "jpg";
      const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const objectKey = `avatars/${user.id}/${filename}`;

      await env.R2_UPLOADS.put(objectKey, file.stream(), {
        httpMetadata: {
          contentType: file.type,
        },
      });

      const avatarUrl = `/api/v1/avatar/${user.id}/${filename}`;
      const now = Date.now();
      const fallbackUsername =
        user.name?.toLowerCase().replaceAll(/[^a-z0-9_]/gu, "") ||
        `user_${user.id.slice(0, 8)}`;

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

      return c.json({ avatarObjectKey: objectKey, url: avatarUrl });
    })
    .get("/avatar/:userId/:filename", async (c) => {
      const { userId, filename } = c.req.param();
      const objectKey = `avatars/${userId}/${filename}`;
      const object = await env.R2_UPLOADS.get(objectKey);
      if (!object) {
        return c.json({ code: "NOT_FOUND", error: "Avatar not found" }, 404);
      }
      const headers = new Headers({
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
      });
      if (object.httpEtag) {
        headers.set("etag", object.httpEtag);
      }
      return new Response(object.body, { headers });
    })
    .get("/profiles", async (c) => {
      const query = (c.req.query("q") ?? "").trim().toLowerCase();
      const rows = await env.DB.prepare(
        `SELECT p.bio, p.username, u.image, u.name,
          (SELECT COUNT(*) FROM follows f WHERE f.followed_user_id = p.user_id) AS followers
         FROM profiles p JOIN user u ON u.id = p.user_id
         WHERE p.is_public = 1 AND (? = '' OR p.username LIKE ? OR lower(u.name) LIKE ?)
         ORDER BY followers DESC, p.username LIMIT 50`
      )
        .bind(query, `%${query}%`, `%${query}%`)
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
          (SELECT COUNT(*) FROM tickets t WHERE t.user_id = p.user_id AND t.status = 'won') AS wins,
          (SELECT COUNT(*) FROM tickets t WHERE t.user_id = p.user_id AND t.status = 'lost') AS losses
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
      const user = await getAuthUser(auth, c.req.raw.headers);
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
      const user = await getAuthUser(auth, c.req.raw.headers);
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
    });
