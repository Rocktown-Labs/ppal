ALTER TABLE `user` ADD COLUMN `phone_number` text;
--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD COLUMN `sms_enabled` integer DEFAULT 0 NOT NULL;
