ALTER TABLE `notification_deliveries` ADD `provider_receipt_id` text;
CREATE INDEX `notification_deliveries_receipt_idx` ON `notification_deliveries` (`provider_receipt_id`);
