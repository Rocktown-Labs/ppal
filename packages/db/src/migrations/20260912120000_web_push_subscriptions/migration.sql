CREATE TABLE `web_push_subscriptions` (
	`auth` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`endpoint` text PRIMARY KEY NOT NULL,
	`last_seen_at` integer NOT NULL,
	`p256dh` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `web_push_subscriptions_user_idx` ON `web_push_subscriptions` (`user_id`);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `notification_deliveries_new` (
	`attempts` integer DEFAULT 0 NOT NULL,
	`channel` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`delivered_at` integer,
	`delivery_key` text NOT NULL,
	`destination` text NOT NULL,
	`error_message` text,
	`id` text PRIMARY KEY NOT NULL,
	`notification_id` text NOT NULL,
	`provider_receipt_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "notification_deliveries_channel_check" CHECK("channel" in ('push', 'email', 'web_push')),
	CONSTRAINT "notification_deliveries_status_check" CHECK("status" in ('pending', 'processing', 'delivered', 'failed'))
);
--> statement-breakpoint
INSERT INTO `notification_deliveries_new` (
	`attempts`, `channel`, `created_at`, `delivered_at`, `delivery_key`,
	`destination`, `error_message`, `id`, `notification_id`, `provider_receipt_id`,
	`status`, `updated_at`
)
SELECT `attempts`, `channel`, `created_at`, `delivered_at`, `delivery_key`,
	`destination`, `error_message`, `id`, `notification_id`, `provider_receipt_id`,
	`status`, `updated_at`
FROM `notification_deliveries`;
--> statement-breakpoint
DROP TABLE `notification_deliveries`;
--> statement-breakpoint
ALTER TABLE `notification_deliveries_new` RENAME TO `notification_deliveries`;
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_deliveries_delivery_key_unique` ON `notification_deliveries` (`delivery_key`);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_status_idx` ON `notification_deliveries` (`status`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `notification_deliveries_receipt_idx` ON `notification_deliveries` (`provider_receipt_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
