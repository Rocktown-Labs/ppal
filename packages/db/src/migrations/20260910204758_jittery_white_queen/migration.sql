CREATE TABLE `follows` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`followed_user_id` text NOT NULL,
	`follower_user_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`followed_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`follower_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "follows_not_self_check" CHECK("follows"."follower_user_id" != "follows"."followed_user_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_pair_uidx` ON `follows` (`follower_user_id`,`followed_user_id`);--> statement-breakpoint
CREATE INDEX `follows_followed_idx` ON `follows` (`followed_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`avatar_object_key` text,
	`bio` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE INDEX `profiles_public_username_idx` ON `profiles` (`is_public`,`username`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`code` text NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`referred_user_id` text,
	`referrer_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`referred_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`referrer_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "referrals_status_check" CHECK("referrals"."status" in ('pending', 'completed', 'expired', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_code_unique` ON `referrals` (`code`);--> statement-breakpoint
CREATE INDEX `referrals_referrer_created_idx` ON `referrals` (`referrer_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `device_tokens` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_seen_at` integer NOT NULL,
	`platform` text NOT NULL,
	`token` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "device_tokens_platform_check" CHECK("device_tokens"."platform" in ('ios', 'android'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_tokens_token_unique` ON `device_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `device_tokens_user_idx` ON `device_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `notification_deliveries` (
	`attempts` integer DEFAULT 0 NOT NULL,
	`channel` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`delivered_at` integer,
	`delivery_key` text NOT NULL,
	`error_message` text,
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_deliveries_channel_check" CHECK("notification_deliveries"."channel" in ('push', 'email')),
	CONSTRAINT "notification_deliveries_status_check" CHECK("notification_deliveries"."status" in ('pending', 'processing', 'delivered', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_delivery_key_unique` ON `notification_deliveries` (`delivery_key`);--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_idx` ON `notification_deliveries` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`email_enabled` integer DEFAULT true NOT NULL,
	`in_app_enabled` integer DEFAULT true NOT NULL,
	`leg_lost` integer DEFAULT true NOT NULL,
	`leg_won` integer DEFAULT true NOT NULL,
	`push_enabled` integer DEFAULT true NOT NULL,
	`ticket_lost` integer DEFAULT true NOT NULL,
	`ticket_won` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`data` text,
	`id` text PRIMARY KEY NOT NULL,
	`milestone_key` text NOT NULL,
	`read_at` integer,
	`ticket_id` text,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_milestone_key_unique` ON `notifications` (`milestone_key`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_created_idx` ON `notifications` (`user_id`,`read_at`,`created_at`);