ALTER TABLE `device_tokens` ADD COLUMN `token_hash` text;
--> statement-breakpoint
CREATE INDEX `device_tokens_hash_idx` ON `device_tokens` (`token_hash`);
