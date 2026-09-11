CREATE TABLE `subscription` (
	`billing_interval` text,
	`cancel_at` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`canceled_at` integer,
	`ended_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`period_end` integer,
	`period_start` integer,
	`plan` text NOT NULL,
	`reference_id` text NOT NULL,
	`seats` integer,
	`status` text DEFAULT 'incomplete' NOT NULL,
	`stripe_customer_id` text,
	`stripe_schedule_id` text,
	`stripe_subscription_id` text,
	`trial_end` integer,
	`trial_start` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_stripe_subscription_id_unique` ON `subscription` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `subscription_reference_id_idx` ON `subscription` (`reference_id`);--> statement-breakpoint
CREATE INDEX `subscription_status_idx` ON `subscription` (`status`);--> statement-breakpoint
ALTER TABLE `user` ADD `stripe_customer_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_stripe_customer_id_unique` ON `user` (`stripe_customer_id`);