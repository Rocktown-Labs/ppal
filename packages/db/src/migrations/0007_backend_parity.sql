ALTER TABLE `historical_import_batches` ADD `idempotency_key` text;
UPDATE `historical_import_batches` SET `idempotency_key` = `id` WHERE `idempotency_key` IS NULL;
CREATE UNIQUE INDEX `historical_import_batches_idempotency_key_uidx` ON `historical_import_batches` (`idempotency_key`);
ALTER TABLE `uploads` ADD `historical_import_batch_id` text REFERENCES `historical_import_batches`(`id`) ON DELETE SET NULL;
CREATE INDEX `uploads_historical_import_batch_idx` ON `uploads` (`historical_import_batch_id`);
ALTER TABLE `tickets` ADD `displayed_result` text;
ALTER TABLE `ticket_legs` ADD `market_components` text;
ALTER TABLE `referrals` ADD `claimed_at` integer;
CREATE UNIQUE INDEX `referrals_referred_user_uidx` ON `referrals` (`referred_user_id`);
CREATE TABLE `operation_failures` (
  `attempts` integer NOT NULL,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `error_message` text NOT NULL,
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL,
  `payload` text NOT NULL,
  `queue` text NOT NULL,
  `replayed_at` integer,
  `status` text DEFAULT 'failed' NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  CONSTRAINT `operation_failures_status_check` CHECK (`status` in ('failed', 'replayed', 'resolved'))
);
CREATE UNIQUE INDEX `operation_failures_message_uidx` ON `operation_failures` (`queue`,`message_id`);
CREATE INDEX `operation_failures_status_created_idx` ON `operation_failures` (`status`,`created_at`);
CREATE TABLE `migration_receipts` (
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `id` text PRIMARY KEY NOT NULL,
  `source` text NOT NULL,
  `source_id` text NOT NULL,
  `target_id` text NOT NULL,
  `target_type` text NOT NULL
);
CREATE UNIQUE INDEX `migration_receipts_source_uidx` ON `migration_receipts` (`source`,`target_type`,`source_id`);
