CREATE TABLE `account` (
	`access_token` text,
	`access_token_expires_at` integer,
	`account_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`id_token` text,
	`issuer` text NOT NULL,
	`password` text,
	`provider_id` text NOT NULL,
	`refresh_token` text,
	`refresh_token_expires_at` integer,
	`scope` text,
	`updated_at` integer NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_accountId_uidx` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`ip_address` text,
	`token` text NOT NULL,
	`updated_at` integer NOT NULL,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`image` text,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `billing_entitlements` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`current_period_end` integer,
	`current_period_start` integer,
	`effective_at` integer NOT NULL,
	`expires_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`provider_reference` text NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "billing_entitlements_plan_check" CHECK("billing_entitlements"."plan" in ('pro', 'creator')),
	CONSTRAINT "billing_entitlements_source_check" CHECK("billing_entitlements"."source" in ('stripe', 'revenuecat', 'manual')),
	CONSTRAINT "billing_entitlements_status_check" CHECK("billing_entitlements"."status" in ('trialing', 'active', 'grace_period', 'past_due', 'paused', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE INDEX `billing_entitlements_user_status_idx` ON `billing_entitlements` (`user_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_entitlements_source_reference_uidx` ON `billing_entitlements` (`source`,`provider_reference`);--> statement-breakpoint
CREATE TABLE `usage_events` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`metadata` text,
	`occurred_at` integer NOT NULL,
	`period_end` integer NOT NULL,
	`period_start` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`resource_id` text,
	`resource_type` text,
	`status` text DEFAULT 'reserved' NOT NULL,
	`type` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "usage_events_quantity_check" CHECK("usage_events"."quantity" > 0),
	CONSTRAINT "usage_events_status_check" CHECK("usage_events"."status" in ('reserved', 'finalized', 'released'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_events_idempotency_key_unique` ON `usage_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `usage_events_user_period_idx` ON `usage_events` (`user_id`,`type`,`status`,`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `webhook_receipts` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`error_message` text,
	`id` text PRIMARY KEY NOT NULL,
	`processed_at` integer,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`type` text NOT NULL,
	CONSTRAINT "webhook_receipts_status_check" CHECK("webhook_receipts"."status" in ('processing', 'processed', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_receipts_provider_event_uidx` ON `webhook_receipts` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `leagues` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`provider_key` text,
	`slug` text NOT NULL,
	`sport_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leagues_slug_unique` ON `leagues` (`slug`);--> statement-breakpoint
CREATE INDEX `leagues_sport_id_idx` ON `leagues` (`sport_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `leagues_provider_key_uidx` ON `leagues` (`provider`,`provider_key`);--> statement-breakpoint
CREATE TABLE `markets` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`metadata` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sport_id` text,
	`subject_type` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`value_type` text NOT NULL,
	FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "markets_subject_type_check" CHECK("markets"."subject_type" in ('player', 'team', 'game')),
	CONSTRAINT "markets_value_type_check" CHECK("markets"."value_type" in ('numeric', 'binary', 'moneyline', 'spread'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `markets_slug_unique` ON `markets` (`slug`);--> statement-breakpoint
CREATE INDEX `markets_sport_id_idx` ON `markets` (`sport_id`);--> statement-breakpoint
CREATE TABLE `participants` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text,
	`metadata` text,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`provider_participant_id` text,
	`short_name` text,
	`sport_id` text NOT NULL,
	`type` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "participants_type_check" CHECK("participants"."type" in ('player', 'team'))
);
--> statement-breakpoint
CREATE INDEX `participants_league_id_idx` ON `participants` (`league_id`);--> statement-breakpoint
CREATE INDEX `participants_name_idx` ON `participants` (`name`);--> statement-breakpoint
CREATE INDEX `participants_sport_id_idx` ON `participants` (`sport_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_provider_id_uidx` ON `participants` (`provider`,`provider_participant_id`);--> statement-breakpoint
CREATE TABLE `sports` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`icon` text,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_slug_unique` ON `sports` (`slug`);--> statement-breakpoint
CREATE TABLE `sports_events` (
	`away_participant_id` text,
	`away_score` real,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`home_participant_id` text,
	`home_score` real,
	`id` text PRIMARY KEY NOT NULL,
	`last_synced_at` integer,
	`league_id` text NOT NULL,
	`next_poll_at` integer,
	`poll_lease_until` integer,
	`provider` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`provider_payload` text,
	`starts_at` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`away_participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`home_participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sports_events_status_check" CHECK("sports_events"."status" in ('scheduled', 'live', 'final', 'postponed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `sports_events_due_poll_idx` ON `sports_events` (`status`,`next_poll_at`,`poll_lease_until`);--> statement-breakpoint
CREATE INDEX `sports_events_league_starts_at_idx` ON `sports_events` (`league_id`,`starts_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sports_events_provider_id_uidx` ON `sports_events` (`provider`,`provider_event_id`);--> statement-breakpoint
CREATE TABLE `extractions` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`error_message` text,
	`id` text PRIMARY KEY NOT NULL,
	`model` text,
	`normalized_response` text,
	`provider` text NOT NULL,
	`raw_response` text,
	`schema_version` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`upload_id` text NOT NULL,
	FOREIGN KEY (`upload_id`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "extractions_status_check" CHECK("extractions"."status" in ('pending', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `extractions_upload_created_at_idx` ON `extractions` (`upload_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `historical_import_batches` (
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`needs_review_count` integer DEFAULT 0 NOT NULL,
	`processed_files` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_files` integer NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	`verified_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "historical_import_batches_status_check" CHECK("historical_import_batches"."status" in ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `historical_import_batches_user_created_at_idx` ON `historical_import_batches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`ai_model` text,
	`ai_response_version` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	`file_size` integer,
	`id` text PRIMARY KEY NOT NULL,
	`ingestion_mode` text DEFAULT 'live' NOT NULL,
	`mime_type` text,
	`object_key` text NOT NULL,
	`original_filename` text,
	`ready_at` integer,
	`retention_expires_at` integer,
	`sha256` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`usage_reservation_key` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "uploads_ingestion_mode_check" CHECK("uploads"."ingestion_mode" in ('live', 'historical')),
	CONSTRAINT "uploads_status_check" CHECK("uploads"."status" in ('pending', 'uploading', 'ready', 'processing', 'extracted', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_object_key_unique` ON `uploads` (`object_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_usage_reservation_key_unique` ON `uploads` (`usage_reservation_key`);--> statement-breakpoint
CREATE INDEX `uploads_status_created_at_idx` ON `uploads` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_user_sha256_uidx` ON `uploads` (`user_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `ticket_legs` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`current_value` real,
	`display_description` text,
	`event_hint` text,
	`id` text PRIMARY KEY NOT NULL,
	`league_id` text,
	`lost_at` integer,
	`market_id` text,
	`operator` text DEFAULT 'over' NOT NULL,
	`participant_id` text,
	`raw_description` text NOT NULL,
	`resolver_confidence` real,
	`resolver_status` text DEFAULT 'ambiguous' NOT NULL,
	`secondary_target_value` real,
	`settled_at` integer,
	`sport_id` text,
	`sports_event_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`subject_name` text NOT NULL,
	`subject_type` text DEFAULT 'player' NOT NULL,
	`target_value` real,
	`ticket_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`won_at` integer,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`market_id`) REFERENCES `markets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sports_event_id`) REFERENCES `sports_events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ticket_legs_operator_check" CHECK("ticket_legs"."operator" in ('over', 'under', 'gte', 'lte', 'equals', 'moneyline', 'spread', 'yes', 'no', 'custom')),
	CONSTRAINT "ticket_legs_resolver_status_check" CHECK("ticket_legs"."resolver_status" in ('resolved', 'ambiguous', 'not_found', 'unsupported')),
	CONSTRAINT "ticket_legs_status_check" CHECK("ticket_legs"."status" in ('pending', 'live', 'won', 'lost', 'push', 'void', 'cancelled', 'unresolved')),
	CONSTRAINT "ticket_legs_subject_type_check" CHECK("ticket_legs"."subject_type" in ('player', 'team', 'game'))
);
--> statement-breakpoint
CREATE INDEX `ticket_legs_event_status_idx` ON `ticket_legs` (`sports_event_id`,`status`);--> statement-breakpoint
CREATE INDEX `ticket_legs_ticket_id_idx` ON `ticket_legs` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `ticket_timeline_events` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`message` text,
	`metadata` text,
	`occurred_at` integer NOT NULL,
	`ticket_id` text NOT NULL,
	`ticket_leg_id` text,
	`title` text NOT NULL,
	`transition_key` text NOT NULL,
	`type` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticket_leg_id`) REFERENCES `ticket_legs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_timeline_events_transition_key_unique` ON `ticket_timeline_events` (`transition_key`);--> statement-breakpoint
CREATE INDEX `ticket_timeline_events_ticket_occurred_at_idx` ON `ticket_timeline_events` (`ticket_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`confirmed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`historical_import_batch_id` text,
	`id` text PRIMARY KEY NOT NULL,
	`ingestion_mode` text DEFAULT 'live' NOT NULL,
	`result_source` text,
	`settled_at` integer,
	`source_name` text,
	`source_upload_id` text,
	`status` text DEFAULT 'needs_review' NOT NULL,
	`ticket_type` text DEFAULT 'parlay' NOT NULL,
	`tracking_started_at` integer,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`user_id` text NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`verified_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`historical_import_batch_id`) REFERENCES `historical_import_batches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`source_upload_id`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tickets_ingestion_mode_check" CHECK("tickets"."ingestion_mode" in ('live', 'historical')),
	CONSTRAINT "tickets_result_source_check" CHECK("tickets"."result_source" is null or "tickets"."result_source" in ('live_provider', 'historical_provider', 'settled_slip', 'manual')),
	CONSTRAINT "tickets_status_check" CHECK("tickets"."status" in ('draft', 'needs_review', 'scheduled', 'live', 'won', 'lost', 'push', 'void', 'partially_void', 'settled')),
	CONSTRAINT "tickets_ticket_type_check" CHECK("tickets"."ticket_type" in ('parlay', 'single', 'sgp', 'teaser', 'round_robin')),
	CONSTRAINT "tickets_verification_status_check" CHECK("tickets"."verification_status" in ('unverified', 'partially_verified', 'verified'))
);
--> statement-breakpoint
CREATE INDEX `tickets_user_status_created_at_idx` ON `tickets` (`user_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `stat_observations` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idempotency_key` text NOT NULL,
	`market_id` text NOT NULL,
	`metadata` text,
	`observed_at` integer NOT NULL,
	`participant_id` text,
	`provider` text NOT NULL,
	`provider_sequence` text NOT NULL,
	`sports_event_id` text NOT NULL,
	`value` real NOT NULL,
	FOREIGN KEY (`market_id`) REFERENCES `markets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sports_event_id`) REFERENCES `sports_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stat_observations_idempotency_key_unique` ON `stat_observations` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `stat_observations_lookup_idx` ON `stat_observations` (`sports_event_id`,`participant_id`,`market_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `stat_observations_provider_sequence_idx` ON `stat_observations` (`provider`,`sports_event_id`,`participant_id`,`market_id`,`provider_sequence`);--> statement-breakpoint
CREATE TABLE `tracking_subscriptions` (
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`market_id` text NOT NULL,
	`participant_id` text,
	`sports_event_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`subscription_key` text NOT NULL,
	`ticket_leg_id` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`market_id`) REFERENCES `markets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sports_event_id`) REFERENCES `sports_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticket_leg_id`) REFERENCES `ticket_legs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tracking_subscriptions_status_check" CHECK("tracking_subscriptions"."status" in ('active', 'paused', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_subscriptions_subscription_key_unique` ON `tracking_subscriptions` (`subscription_key`);--> statement-breakpoint
CREATE INDEX `tracking_subscriptions_lookup_idx` ON `tracking_subscriptions` (`sports_event_id`,`participant_id`,`market_id`,`status`);--> statement-breakpoint
CREATE INDEX `tracking_subscriptions_leg_event_market_idx` ON `tracking_subscriptions` (`ticket_leg_id`,`sports_event_id`,`participant_id`,`market_id`);