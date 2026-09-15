ALTER TABLE `user` ADD `role` text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;
--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;
--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;
--> statement-breakpoint
UPDATE `user`
SET `role` = 'admin'
WHERE lower(`email`) = 'cg@rocktownlabs.com';
--> statement-breakpoint
INSERT INTO `billing_entitlements` (
  `created_at`, `effective_at`, `id`, `plan`, `provider_reference`, `source`,
  `status`, `updated_at`, `user_id`
)
SELECT
  CAST(unixepoch('subsecond') * 1000 AS INTEGER),
  CAST(unixepoch('subsecond') * 1000 AS INTEGER),
  'manual-founder-cg-creator',
  'creator',
  'manual:founder:cg@rocktownlabs.com',
  'manual',
  'active',
  CAST(unixepoch('subsecond') * 1000 AS INTEGER),
  `id`
FROM `user`
WHERE lower(`email`) = 'cg@rocktownlabs.com'
ON CONFLICT (`source`, `provider_reference`) DO UPDATE SET
  `plan` = excluded.`plan`,
  `status` = excluded.`status`,
  `expires_at` = NULL,
  `updated_at` = excluded.`updated_at`,
  `user_id` = excluded.`user_id`;
