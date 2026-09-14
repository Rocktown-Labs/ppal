ALTER TABLE `tickets` ADD `notification_interval_minutes` integer DEFAULT 10 NOT NULL;
--> statement-breakpoint
ALTER TABLE `tickets` ADD `last_progress_notified_at` integer;
--> statement-breakpoint
ALTER TABLE `ticket_legs` ADD `last_notified_snapshot` text;
