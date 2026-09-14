CREATE TABLE `communities` (
  `access` text DEFAULT 'free' NOT NULL,
  `archived_at` integer,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `description` text,
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `price_cents` integer,
  `rules` text,
  `slug` text NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `visibility` text DEFAULT 'public' NOT NULL,
  CONSTRAINT `communities_access_check` CHECK (`access` in ('free', 'paid')),
  CONSTRAINT `communities_visibility_check` CHECK (`visibility` in ('public', 'private')),
  CONSTRAINT `communities_price_check` CHECK (`price_cents` is null or (`price_cents` >= 100 and `price_cents` <= 100000))
);
CREATE UNIQUE INDEX `communities_slug_uidx` ON `communities` (`slug`);
CREATE INDEX `communities_owner_idx` ON `communities` (`owner_user_id`, `created_at`);
CREATE INDEX `communities_visibility_idx` ON `communities` (`visibility`, `created_at`);

CREATE TABLE `community_members` (
  `community_id` text NOT NULL REFERENCES `communities`(`id`) ON DELETE CASCADE,
  `joined_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `paid_at` integer,
  `payment_reference` text,
  `role` text DEFAULT 'member' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  CONSTRAINT `community_members_role_check` CHECK (`role` in ('owner', 'moderator', 'member')),
  CONSTRAINT `community_members_status_check` CHECK (`status` in ('active', 'pending', 'muted', 'banned')),
  PRIMARY KEY (`community_id`, `user_id`)
);
CREATE INDEX `community_members_community_idx` ON `community_members` (`community_id`, `status`, `joined_at`);
CREATE INDEX `community_members_user_idx` ON `community_members` (`user_id`, `joined_at`);

CREATE TABLE `community_channels` (
  `community_id` text NOT NULL REFERENCES `communities`(`id`) ON DELETE CASCADE,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `description` text,
  `id` text PRIMARY KEY NOT NULL,
  `is_archived` integer DEFAULT false NOT NULL,
  `is_default` integer DEFAULT false NOT NULL,
  `name` text NOT NULL,
  `position` integer DEFAULT 0 NOT NULL,
  `slug` text NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
CREATE INDEX `community_channels_position_idx` ON `community_channels` (`community_id`, `position`);
CREATE UNIQUE INDEX `community_channels_slug_uidx` ON `community_channels` (`community_id`, `slug`);

CREATE TABLE `community_messages` (
  `author_user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `body` text NOT NULL,
  `channel_id` text NOT NULL REFERENCES `community_channels`(`id`) ON DELETE CASCADE,
  `community_id` text NOT NULL REFERENCES `communities`(`id`) ON DELETE CASCADE,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `deleted_at` integer,
  `edited_at` integer,
  `id` text PRIMARY KEY NOT NULL,
  `mentions` text DEFAULT '[]' NOT NULL,
  `reply_to_id` text
);
CREATE INDEX `community_messages_channel_idx` ON `community_messages` (`channel_id`, `created_at`, `id`);
CREATE INDEX `community_messages_community_idx` ON `community_messages` (`community_id`, `created_at`);

CREATE TABLE `community_reports` (
  `community_id` text NOT NULL REFERENCES `communities`(`id`) ON DELETE CASCADE,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL REFERENCES `community_messages`(`id`) ON DELETE CASCADE,
  `reason` text NOT NULL,
  `reporter_user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `resolved_at` integer,
  `resolved_by` text REFERENCES `user`(`id`) ON DELETE SET NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  CONSTRAINT `community_reports_status_check` CHECK (`status` in ('open', 'resolved', 'dismissed'))
);
CREATE INDEX `community_reports_community_idx` ON `community_reports` (`community_id`, `status`, `created_at`);
CREATE UNIQUE INDEX `community_reports_reporter_message_uidx` ON `community_reports` (`reporter_user_id`, `message_id`);
