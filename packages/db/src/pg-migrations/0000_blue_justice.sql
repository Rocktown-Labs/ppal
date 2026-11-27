CREATE TABLE "audit_logs" (
	"action" text NOT NULL,
	"actor_user_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"ip_country" text,
	"metadata" text,
	"occurred_at" bigint NOT NULL,
	"outcome" text NOT NULL,
	"request_id" text,
	"target_id" text,
	"target_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"id_token" text,
	"issuer" text NOT NULL,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"aaguid" text,
	"backed_up" boolean NOT NULL,
	"counter" integer NOT NULL,
	"created_at" timestamp with time zone,
	"credential_id" text NOT NULL,
	"device_type" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"transports" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"impersonated_by" text,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"billing_interval" text,
	"cancel_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"id" text PRIMARY KEY NOT NULL,
	"period_end" timestamp with time zone,
	"period_start" timestamp with time zone,
	"plan" text NOT NULL,
	"reference_id" text NOT NULL,
	"seats" integer,
	"status" text DEFAULT 'incomplete' NOT NULL,
	"stripe_customer_id" text,
	"stripe_schedule_id" text,
	"stripe_subscription_id" text,
	"trial_end" timestamp with time zone,
	"trial_start" timestamp with time zone,
	CONSTRAINT "subscription_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "twoFactor" (
	"backup_codes" text NOT NULL,
	"failed_verification_count" integer DEFAULT 0,
	"id" text PRIMARY KEY NOT NULL,
	"locked_until" timestamp with time zone,
	"secret" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "user" (
	"ban_expires" timestamp with time zone,
	"ban_reason" text,
	"banned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"phone_number" text,
	"referral_code" text,
	"role" text DEFAULT 'user' NOT NULL,
	"stripe_customer_id" text,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_referral_code_unique" UNIQUE("referral_code"),
	CONSTRAINT "user_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_entitlements" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"current_period_end" bigint,
	"current_period_start" bigint,
	"effective_at" bigint NOT NULL,
	"expires_at" bigint,
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"provider_reference" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "billing_entitlements_plan_check" CHECK ("billing_entitlements"."plan" in ('pro', 'creator')),
	CONSTRAINT "billing_entitlements_source_check" CHECK ("billing_entitlements"."source" in ('stripe', 'revenuecat', 'manual')),
	CONSTRAINT "billing_entitlements_status_check" CHECK ("billing_entitlements"."status" in ('trialing', 'active', 'grace_period', 'past_due', 'paused', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" text,
	"occurred_at" bigint NOT NULL,
	"period_end" bigint NOT NULL,
	"period_start" bigint NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"resource_id" text,
	"resource_type" text,
	"status" text DEFAULT 'reserved' NOT NULL,
	"type" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "usage_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "usage_events_quantity_check" CHECK ("usage_events"."quantity" > 0),
	CONSTRAINT "usage_events_status_check" CHECK ("usage_events"."status" in ('reserved', 'finalized', 'released'))
);
--> statement-breakpoint
CREATE TABLE "webhook_receipts" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"error_message" text,
	"id" text PRIMARY KEY NOT NULL,
	"processed_at" bigint,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "webhook_receipts_status_check" CHECK ("webhook_receipts"."status" in ('processing', 'processed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"provider_key" text,
	"slug" text NOT NULL,
	"sport_id" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "leagues_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sport_id" text,
	"subject_type" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"value_type" text NOT NULL,
	CONSTRAINT "markets_slug_unique" UNIQUE("slug"),
	CONSTRAINT "markets_subject_type_check" CHECK ("markets"."subject_type" in ('player', 'team', 'game')),
	CONSTRAINT "markets_value_type_check" CHECK ("markets"."value_type" in ('numeric', 'binary', 'moneyline', 'spread'))
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text,
	"metadata" text,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"provider_participant_id" text,
	"short_name" text,
	"sport_id" text NOT NULL,
	"type" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "participants_type_check" CHECK ("participants"."type" in ('player', 'team'))
);
--> statement-breakpoint
CREATE TABLE "provider_schedule_syncs" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"schedule_date" text NOT NULL,
	"sport_slug" text NOT NULL,
	"synced_at" bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"icon" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "sports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sports_events" (
	"away_participant_id" text,
	"away_score" double precision,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"home_participant_id" text,
	"home_score" double precision,
	"id" text PRIMARY KEY NOT NULL,
	"last_synced_at" bigint,
	"league_id" text NOT NULL,
	"next_poll_at" bigint,
	"poll_lease_until" bigint,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"provider_payload" text,
	"starts_at" bigint NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "sports_events_status_check" CHECK ("sports_events"."status" in ('scheduled', 'live', 'final', 'postponed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "communities" (
	"access" text DEFAULT 'free' NOT NULL,
	"archived_at" bigint,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"price_cents" integer,
	"rules" text,
	"slug" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	CONSTRAINT "communities_slug_unique" UNIQUE("slug"),
	CONSTRAINT "communities_access_check" CHECK ("communities"."access" in ('free', 'paid')),
	CONSTRAINT "communities_visibility_check" CHECK ("communities"."visibility" in ('public', 'private')),
	CONSTRAINT "communities_price_check" CHECK ("communities"."price_cents" is null or ("communities"."price_cents" >= 100 and "communities"."price_cents" <= 100000))
);
--> statement-breakpoint
CREATE TABLE "community_channels" (
	"community_id" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_archived" integer DEFAULT 0 NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"slug" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"community_id" text NOT NULL,
	"joined_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"paid_at" bigint,
	"payment_reference" text,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "community_members_role_check" CHECK ("community_members"."role" in ('owner', 'moderator', 'member')),
	CONSTRAINT "community_members_status_check" CHECK ("community_members"."status" in ('active', 'pending', 'muted', 'banned'))
);
--> statement-breakpoint
CREATE TABLE "community_message_reactions" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"emoji" text NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "community_message_reactions_message_id_user_id_emoji_pk" PRIMARY KEY("message_id","user_id","emoji"),
	CONSTRAINT "community_message_reactions_emoji_length_check" CHECK (length("community_message_reactions"."emoji") between 1 and 16)
);
--> statement-breakpoint
CREATE TABLE "community_messages" (
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"channel_id" text NOT NULL,
	"community_id" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"deleted_at" bigint,
	"edited_at" bigint,
	"id" text PRIMARY KEY NOT NULL,
	"mentions" text DEFAULT '[]' NOT NULL,
	"reply_to_id" text
);
--> statement-breakpoint
CREATE TABLE "community_reports" (
	"community_id" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"reason" text NOT NULL,
	"reporter_user_id" text NOT NULL,
	"resolved_at" bigint,
	"resolved_by" text,
	"status" text DEFAULT 'open' NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "community_reports_status_check" CHECK ("community_reports"."status" in ('open', 'resolved', 'dismissed'))
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"followed_user_id" text NOT NULL,
	"follower_user_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	CONSTRAINT "follows_not_self_check" CHECK ("follows"."follower_user_id" != "follows"."followed_user_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"avatar_object_key" text,
	"bio" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"is_public" integer DEFAULT 1 NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"claimed_at" bigint,
	"code" text NOT NULL,
	"completed_at" bigint,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"referred_user_id" text,
	"referrer_user_id" text NOT NULL,
	"request_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	CONSTRAINT "referrals_status_check" CHECK ("referrals"."status" in ('pending', 'completed', 'expired', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"error_message" text,
	"id" text PRIMARY KEY NOT NULL,
	"model" text,
	"normalized_response" text,
	"provider" text NOT NULL,
	"raw_response" text,
	"schema_version" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"upload_id" text NOT NULL,
	CONSTRAINT "extractions_status_check" CHECK ("extractions"."status" in ('pending', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "historical_import_batches" (
	"completed_at" bigint,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"needs_review_count" integer DEFAULT 0 NOT NULL,
	"processed_files" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_files" integer NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text NOT NULL,
	"verified_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "historical_import_batches_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "historical_import_batches_status_check" CHECK ("historical_import_batches"."status" in ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"ai_model" text,
	"ai_response_version" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"deleted_at" bigint,
	"file_size" integer,
	"historical_import_batch_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"ingestion_mode" text DEFAULT 'live' NOT NULL,
	"mime_type" text,
	"object_key" text NOT NULL,
	"original_filename" text,
	"ready_at" bigint,
	"retention_expires_at" bigint,
	"sha256" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"usage_reservation_key" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "uploads_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "uploads_usage_reservation_key_unique" UNIQUE("usage_reservation_key"),
	CONSTRAINT "uploads_ingestion_mode_check" CHECK ("uploads"."ingestion_mode" in ('live', 'historical')),
	CONSTRAINT "uploads_status_check" CHECK ("uploads"."status" in ('pending', 'uploading', 'ready', 'processing', 'extracted', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"last_seen_at" bigint NOT NULL,
	"platform" text NOT NULL,
	"token" text NOT NULL,
	"token_hash" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "device_tokens_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "device_tokens_platform_check" CHECK ("device_tokens"."platform" in ('ios', 'android'))
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"channel" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"delivered_at" bigint,
	"delivery_key" text NOT NULL,
	"destination" text NOT NULL,
	"error_message" text,
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"provider_receipt_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "notification_deliveries_delivery_key_unique" UNIQUE("delivery_key"),
	CONSTRAINT "notification_deliveries_channel_check" CHECK ("notification_deliveries"."channel" in ('push', 'email', 'web_push', 'sms')),
	CONSTRAINT "notification_deliveries_status_check" CHECK ("notification_deliveries"."status" in ('pending', 'processing', 'delivered', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"email_enabled" integer DEFAULT 1 NOT NULL,
	"in_app_enabled" integer DEFAULT 1 NOT NULL,
	"leg_lost" integer DEFAULT 1 NOT NULL,
	"leg_won" integer DEFAULT 1 NOT NULL,
	"push_enabled" integer DEFAULT 1 NOT NULL,
	"sms_enabled" integer DEFAULT 0 NOT NULL,
	"ticket_lost" integer DEFAULT 1 NOT NULL,
	"ticket_won" integer DEFAULT 1 NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_stream_leases" (
	"connection_id" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"body" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"data" text,
	"id" text PRIMARY KEY NOT NULL,
	"in_app_visible" integer DEFAULT 1 NOT NULL,
	"milestone_key" text NOT NULL,
	"read_at" bigint,
	"ticket_id" text,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "notifications_milestone_key_unique" UNIQUE("milestone_key")
);
--> statement-breakpoint
CREATE TABLE "web_push_subscriptions" (
	"auth" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"endpoint" text PRIMARY KEY NOT NULL,
	"last_seen_at" bigint NOT NULL,
	"p256dh" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_receipts" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"target_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operation_failures" (
	"attempts" integer NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"error_message" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"payload" text NOT NULL,
	"queue" text NOT NULL,
	"replayed_at" bigint,
	"status" text DEFAULT 'failed' NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "operation_failures_status_check" CHECK ("operation_failures"."status" in ('failed', 'replayed', 'resolved'))
);
--> statement-breakpoint
CREATE TABLE "ticket_legs" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"current_value" double precision,
	"display_description" text,
	"event_hint" text,
	"id" text PRIMARY KEY NOT NULL,
	"last_notified_snapshot" text,
	"league_id" text,
	"lost_at" bigint,
	"market_components" text,
	"market_id" text,
	"operator" text DEFAULT 'over' NOT NULL,
	"participant_id" text,
	"raw_description" text NOT NULL,
	"raw_league_name" text,
	"raw_market_name" text,
	"raw_sport_name" text,
	"resolver_confidence" double precision,
	"resolver_status" text DEFAULT 'ambiguous' NOT NULL,
	"secondary_target_value" double precision,
	"settled_at" bigint,
	"sport_id" text,
	"sports_event_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"subject_name" text NOT NULL,
	"subject_type" text DEFAULT 'player' NOT NULL,
	"target_value" double precision,
	"ticket_id" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"won_at" bigint,
	CONSTRAINT "ticket_legs_operator_check" CHECK ("ticket_legs"."operator" in ('over', 'under', 'gte', 'lte', 'equals', 'moneyline', 'spread', 'yes', 'no', 'custom')),
	CONSTRAINT "ticket_legs_resolver_status_check" CHECK ("ticket_legs"."resolver_status" in ('resolved', 'ambiguous', 'not_found', 'unsupported')),
	CONSTRAINT "ticket_legs_status_check" CHECK ("ticket_legs"."status" in ('pending', 'live', 'won', 'lost', 'push', 'void', 'cancelled', 'unresolved')),
	CONSTRAINT "ticket_legs_subject_type_check" CHECK ("ticket_legs"."subject_type" in ('player', 'team', 'game'))
);
--> statement-breakpoint
CREATE TABLE "ticket_timeline_events" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"message" text,
	"metadata" text,
	"occurred_at" bigint NOT NULL,
	"ticket_id" text NOT NULL,
	"ticket_leg_id" text,
	"title" text NOT NULL,
	"transition_key" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "ticket_timeline_events_transition_key_unique" UNIQUE("transition_key")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"confirmed_at" bigint,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"displayed_result" text,
	"historical_import_batch_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"ingestion_mode" text DEFAULT 'live' NOT NULL,
	"last_progress_notified_at" bigint,
	"notification_interval_minutes" integer DEFAULT 10 NOT NULL,
	"result_source" text,
	"settled_at" bigint,
	"source_name" text,
	"source_upload_id" text,
	"status" text DEFAULT 'needs_review' NOT NULL,
	"ticket_type" text DEFAULT 'parlay' NOT NULL,
	"tracking_started_at" bigint,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"user_id" text NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"verified_at" bigint,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tickets_ingestion_mode_check" CHECK ("tickets"."ingestion_mode" in ('live', 'historical')),
	CONSTRAINT "tickets_notification_interval_check" CHECK ("tickets"."notification_interval_minutes" in (5, 10, 15)),
	CONSTRAINT "tickets_result_source_check" CHECK ("tickets"."result_source" is null or "tickets"."result_source" in ('live_provider', 'historical_provider', 'settled_slip', 'manual')),
	CONSTRAINT "tickets_status_check" CHECK ("tickets"."status" in ('draft', 'needs_review', 'scheduled', 'live', 'won', 'lost', 'push', 'void', 'partially_void', 'settled')),
	CONSTRAINT "tickets_ticket_type_check" CHECK ("tickets"."ticket_type" in ('parlay', 'single', 'sgp', 'teaser', 'round_robin')),
	CONSTRAINT "tickets_verification_status_check" CHECK ("tickets"."verification_status" in ('unverified', 'partially_verified', 'verified'))
);
--> statement-breakpoint
CREATE TABLE "stat_observations" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"market_id" text NOT NULL,
	"metadata" text,
	"observed_at" bigint NOT NULL,
	"participant_id" text,
	"provider" text NOT NULL,
	"provider_sequence" text NOT NULL,
	"sports_event_id" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "stat_observations_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "tracking_subscriptions" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"market_id" text NOT NULL,
	"participant_id" text,
	"sports_event_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"subscription_key" text NOT NULL,
	"ticket_leg_id" text NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "tracking_subscriptions_subscription_key_unique" UNIQUE("subscription_key"),
	CONSTRAINT "tracking_subscriptions_status_check" CHECK ("tracking_subscriptions"."status" in ('active', 'paused', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_entitlements" ADD CONSTRAINT "billing_entitlements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markets" ADD CONSTRAINT "markets_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_events" ADD CONSTRAINT "sports_events_away_participant_id_participants_id_fk" FOREIGN KEY ("away_participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_events" ADD CONSTRAINT "sports_events_home_participant_id_participants_id_fk" FOREIGN KEY ("home_participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports_events" ADD CONSTRAINT "sports_events_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_channels" ADD CONSTRAINT "community_channels_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message_reactions" ADD CONSTRAINT "community_message_reactions_message_id_community_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_message_reactions" ADD CONSTRAINT "community_message_reactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_channel_id_community_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."community_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_message_id_community_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."community_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followed_user_id_user_id_fk" FOREIGN KEY ("followed_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_user_id_user_id_fk" FOREIGN KEY ("follower_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_import_batches" ADD CONSTRAINT "historical_import_batches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_stream_leases" ADD CONSTRAINT "notification_stream_leases_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_push_subscriptions" ADD CONSTRAINT "web_push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_legs" ADD CONSTRAINT "ticket_legs_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_legs" ADD CONSTRAINT "ticket_legs_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_legs" ADD CONSTRAINT "ticket_legs_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_legs" ADD CONSTRAINT "ticket_legs_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_legs" ADD CONSTRAINT "ticket_legs_sports_event_id_sports_events_id_fk" FOREIGN KEY ("sports_event_id") REFERENCES "public"."sports_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_legs" ADD CONSTRAINT "ticket_legs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_timeline_events" ADD CONSTRAINT "ticket_timeline_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_timeline_events" ADD CONSTRAINT "ticket_timeline_events_ticket_leg_id_ticket_legs_id_fk" FOREIGN KEY ("ticket_leg_id") REFERENCES "public"."ticket_legs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_historical_import_batch_id_historical_import_batches_id_fk" FOREIGN KEY ("historical_import_batch_id") REFERENCES "public"."historical_import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_source_upload_id_uploads_id_fk" FOREIGN KEY ("source_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_observations" ADD CONSTRAINT "stat_observations_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_observations" ADD CONSTRAINT "stat_observations_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_observations" ADD CONSTRAINT "stat_observations_sports_event_id_sports_events_id_fk" FOREIGN KEY ("sports_event_id") REFERENCES "public"."sports_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_subscriptions" ADD CONSTRAINT "tracking_subscriptions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_subscriptions" ADD CONSTRAINT "tracking_subscriptions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_subscriptions" ADD CONSTRAINT "tracking_subscriptions_sports_event_id_sports_events_id_fk" FOREIGN KEY ("sports_event_id") REFERENCES "public"."sports_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_subscriptions" ADD CONSTRAINT "tracking_subscriptions_ticket_leg_id_ticket_legs_id_fk" FOREIGN KEY ("ticket_leg_id") REFERENCES "public"."ticket_legs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_occurred_idx" ON "audit_logs" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_occurred_idx" ON "audit_logs" USING btree ("target_type","target_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_reference_id_idx" ON "subscription" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "twoFactor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_userId_idx" ON "twoFactor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "billing_entitlements_user_status_idx" ON "billing_entitlements" USING btree ("user_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_entitlements_source_reference_uidx" ON "billing_entitlements" USING btree ("source","provider_reference");--> statement-breakpoint
CREATE INDEX "usage_events_user_period_idx" ON "usage_events" USING btree ("user_id","type","status","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_receipts_provider_event_uidx" ON "webhook_receipts" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "leagues_sport_id_idx" ON "leagues" USING btree ("sport_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leagues_provider_key_uidx" ON "leagues" USING btree ("provider","provider_key");--> statement-breakpoint
CREATE INDEX "markets_sport_id_idx" ON "markets" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "participants_league_id_idx" ON "participants" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "participants_name_idx" ON "participants" USING btree ("name");--> statement-breakpoint
CREATE INDEX "participants_sport_id_idx" ON "participants" USING btree ("sport_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_provider_id_uidx" ON "participants" USING btree ("provider","provider_participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_schedule_syncs_key_uidx" ON "provider_schedule_syncs" USING btree ("provider","sport_slug","schedule_date");--> statement-breakpoint
CREATE INDEX "sports_events_due_poll_idx" ON "sports_events" USING btree ("status","next_poll_at","poll_lease_until");--> statement-breakpoint
CREATE INDEX "sports_events_league_starts_at_idx" ON "sports_events" USING btree ("league_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sports_events_provider_id_uidx" ON "sports_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "communities_owner_idx" ON "communities" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "communities_visibility_idx" ON "communities" USING btree ("visibility","created_at");--> statement-breakpoint
CREATE INDEX "community_channels_position_idx" ON "community_channels" USING btree ("community_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "community_channels_slug_uidx" ON "community_channels" USING btree ("community_id","slug");--> statement-breakpoint
CREATE INDEX "community_members_community_idx" ON "community_members" USING btree ("community_id","status","joined_at");--> statement-breakpoint
CREATE INDEX "community_members_user_idx" ON "community_members" USING btree ("user_id","joined_at");--> statement-breakpoint
CREATE UNIQUE INDEX "community_members_pair_uidx" ON "community_members" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "community_message_reactions_message_idx" ON "community_message_reactions" USING btree ("message_id","emoji");--> statement-breakpoint
CREATE INDEX "community_messages_channel_idx" ON "community_messages" USING btree ("channel_id","created_at","id");--> statement-breakpoint
CREATE INDEX "community_messages_community_idx" ON "community_messages" USING btree ("community_id","created_at");--> statement-breakpoint
CREATE INDEX "community_reports_community_idx" ON "community_reports" USING btree ("community_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "community_reports_reporter_message_uidx" ON "community_reports" USING btree ("reporter_user_id","message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_pair_uidx" ON "follows" USING btree ("follower_user_id","followed_user_id");--> statement-breakpoint
CREATE INDEX "follows_followed_idx" ON "follows" USING btree ("followed_user_id","created_at");--> statement-breakpoint
CREATE INDEX "profiles_public_username_idx" ON "profiles" USING btree ("is_public","username");--> statement-breakpoint
CREATE INDEX "referrals_referrer_created_idx" ON "referrals" USING btree ("referrer_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referred_user_uidx" ON "referrals" USING btree ("referred_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referrer_request_uidx" ON "referrals" USING btree ("referrer_user_id","request_key");--> statement-breakpoint
CREATE INDEX "extractions_upload_created_at_idx" ON "extractions" USING btree ("upload_id","created_at");--> statement-breakpoint
CREATE INDEX "historical_import_batches_user_created_at_idx" ON "historical_import_batches" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "uploads_status_created_at_idx" ON "uploads" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_user_sha256_uidx" ON "uploads" USING btree ("user_id","sha256");--> statement-breakpoint
CREATE INDEX "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "notification_stream_leases_expires_idx" ON "notification_stream_leases" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "web_push_subscriptions_user_idx" ON "web_push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "migration_receipts_source_uidx" ON "migration_receipts" USING btree ("source","target_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operation_failures_message_uidx" ON "operation_failures" USING btree ("queue","message_id");--> statement-breakpoint
CREATE INDEX "operation_failures_status_created_idx" ON "operation_failures" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ticket_legs_event_status_idx" ON "ticket_legs" USING btree ("sports_event_id","status");--> statement-breakpoint
CREATE INDEX "ticket_legs_ticket_id_idx" ON "ticket_legs" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_timeline_events_ticket_occurred_at_idx" ON "ticket_timeline_events" USING btree ("ticket_id","occurred_at");--> statement-breakpoint
CREATE INDEX "tickets_user_status_created_at_idx" ON "tickets" USING btree ("user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "stat_observations_lookup_idx" ON "stat_observations" USING btree ("sports_event_id","participant_id","market_id","observed_at");--> statement-breakpoint
CREATE INDEX "stat_observations_provider_sequence_idx" ON "stat_observations" USING btree ("provider","sports_event_id","participant_id","market_id","provider_sequence");--> statement-breakpoint
CREATE INDEX "tracking_subscriptions_lookup_idx" ON "tracking_subscriptions" USING btree ("sports_event_id","participant_id","market_id","status");--> statement-breakpoint
CREATE INDEX "tracking_subscriptions_leg_event_market_idx" ON "tracking_subscriptions" USING btree ("ticket_leg_id","sports_event_id","participant_id","market_id");