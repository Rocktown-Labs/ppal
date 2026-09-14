CREATE TABLE `passkey` (
	`aaguid` text,
	`backed_up` integer NOT NULL,
	`counter` integer NOT NULL,
	`created_at` integer,
	`credential_id` text NOT NULL,
	`device_type` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`public_key` text NOT NULL,
	`transports` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `passkey_credentialID_idx` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkey_userId_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE TABLE `twoFactor` (
	`backup_codes` text NOT NULL,
	`failed_verification_count` integer DEFAULT 0,
	`id` text PRIMARY KEY NOT NULL,
	`locked_until` integer,
	`secret` text NOT NULL,
	`user_id` text NOT NULL,
	`verified` integer DEFAULT true,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `two_factor_secret_idx` ON `twoFactor` (`secret`);--> statement-breakpoint
CREATE INDEX `two_factor_userId_idx` ON `twoFactor` (`user_id`);--> statement-breakpoint
ALTER TABLE `user` ADD `two_factor_enabled` integer DEFAULT false NOT NULL;