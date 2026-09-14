CREATE TABLE `audit_logs` (
	`action` text NOT NULL,
	`actor_user_id` text,
	`id` text PRIMARY KEY NOT NULL,
	`ip_country` text,
	`metadata` text,
	`occurred_at` integer NOT NULL,
	`outcome` text NOT NULL,
	`request_id` text,
	`target_id` text,
	`target_type` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_occurred_idx` ON `audit_logs` (`actor_user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_target_occurred_idx` ON `audit_logs` (`target_type`,`target_id`,`occurred_at`);