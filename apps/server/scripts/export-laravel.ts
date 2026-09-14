import { Database } from "bun:sqlite";

const [sourcePath, outputPath = "./laravel-to-d1.sql"] = process.argv.slice(2);
if (!sourcePath) {
  throw new Error(
    "Usage: bun scripts/export-laravel.ts <database.sqlite> [output.sql]"
  );
}

type Row = Record<string, unknown>;
const source = new Database(sourcePath, { readonly: true, strict: true });
const rows = (table: string): Row[] =>
  source.query(`SELECT * FROM ${table}`).all() as Row[];
const textId = (table: string, value: unknown): string =>
  `legacy:${table}:${String(value)}`;
const timestamp = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};
const literal = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
};
const jsonRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};
const insert = (table: string, values: Record<string, unknown>): string => {
  const entries = Object.entries(values);
  return `INSERT OR IGNORE INTO ${table} (${entries.map(([key]) => `\`${key}\``).join(",")}) VALUES (${entries.map(([, value]) => literal(value)).join(",")});`;
};

const referralStatus = (value: unknown): string => {
  const status = String(value);
  if (["qualified", "rewarded"].includes(status)) {
    return "completed";
  }
  return status === "rejected" ? "cancelled" : status;
};

const output = ["PRAGMA foreign_keys=ON;", "BEGIN IMMEDIATE;"];
for (const row of rows("users")) {
  const userId = textId("user", row.id);
  const createdAt = timestamp(row.created_at) ?? Date.now();
  output.push(
    insert("user", {
      created_at: createdAt,
      email: String(row.email).toLowerCase(),
      email_verified: row.email_verified_at ? 1 : 0,
      id: userId,
      image: row.avatar_url,
      name: row.name,
      referral_code: row.referral_code,
      stripe_customer_id: row.stripe_id,
      two_factor_enabled: row.two_factor_confirmed_at ? 1 : 0,
      updated_at: timestamp(row.updated_at) ?? createdAt,
    }),
    insert("account", {
      account_id: userId,
      created_at: createdAt,
      id: textId("account", row.id),
      issuer: "credential",
      password: String(row.password ?? "").replace(/^\$2y\$/u, "$2b$"),
      provider_id: "credential",
      updated_at: timestamp(row.updated_at) ?? createdAt,
      user_id: userId,
    })
  );
  if (row.username) {
    output.push(
      insert("profiles", {
        bio: row.bio,
        is_public: row.profile_visibility === "private" ? 0 : 1,
        updated_at: timestamp(row.updated_at) ?? createdAt,
        user_id: userId,
        username: String(row.username).toLowerCase(),
      })
    );
  }
  if (row.expo_push_token) {
    output.push(
      insert("device_tokens", {
        id: textId("device", row.id),
        last_seen_at: timestamp(row.updated_at) ?? createdAt,
        platform: "ios",
        token: row.expo_push_token,
        updated_at: timestamp(row.updated_at) ?? createdAt,
        user_id: userId,
      })
    );
  }
  output.push(
    insert("migration_receipts", {
      id: crypto.randomUUID(),
      source: "laravel",
      source_id: String(row.id),
      target_id: userId,
      target_type: "user",
    })
  );
}
for (const row of rows("subscriptions")) {
  const stripePrice = String(row.stripe_price ?? "").toLowerCase();
  const isRevenueCat = String(row.stripe_id ?? "").startsWith("revenuecat_");
  const plan = stripePrice.includes("creator") ? "creator" : "pro";
  const rawStatus = String(row.stripe_status ?? "active");
  const supportedStatuses = [
    "active",
    "cancelled",
    "past_due",
    "paused",
    "trialing",
  ];
  let status = "active";
  if (rawStatus === "canceled") {
    status = "cancelled";
  } else if (supportedStatuses.includes(rawStatus)) {
    status = rawStatus;
  }
  const createdAt = timestamp(row.created_at) ?? Date.now();
  output.push(
    insert("billing_entitlements", {
      created_at: createdAt,
      effective_at: createdAt,
      expires_at: timestamp(row.ends_at ?? row.trial_ends_at),
      id: textId("entitlement", row.id),
      plan,
      provider_reference: row.stripe_id,
      source: isRevenueCat ? "revenuecat" : "stripe",
      status,
      updated_at: timestamp(row.updated_at) ?? createdAt,
      user_id: textId("user", row.user_id),
    })
  );
}
for (const row of rows("sports")) {
  output.push(
    insert("sports", {
      created_at: timestamp(row.created_at),
      icon: row.icon,
      id: textId("sport", row.id),
      name: row.name,
      slug: row.slug,
      updated_at: timestamp(row.updated_at),
    })
  );
}
for (const row of rows("leagues")) {
  output.push(
    insert("leagues", {
      created_at: timestamp(row.created_at),
      id: textId("league", row.id),
      name: row.name,
      provider: "sportradar",
      provider_key: row.provider_key,
      slug: row.slug,
      sport_id: textId("sport", row.sport_id),
      updated_at: timestamp(row.updated_at),
    })
  );
}
for (const row of rows("participants")) {
  output.push(
    insert("participants", {
      created_at: timestamp(row.created_at),
      id: textId("participant", row.id),
      league_id: row.league_id ? textId("league", row.league_id) : null,
      metadata: row.metadata_json,
      name: row.name,
      provider: row.provider,
      provider_participant_id: row.provider_participant_id,
      short_name: row.short_name,
      sport_id: textId("sport", row.sport_id),
      type: row.type,
      updated_at: timestamp(row.updated_at),
    })
  );
}
for (const row of rows("markets")) {
  output.push(
    insert("markets", {
      created_at: timestamp(row.created_at),
      id: textId("market", row.id),
      metadata: row.metadata_json,
      name: row.name,
      slug: row.slug,
      sport_id: row.sport_id ? textId("sport", row.sport_id) : null,
      subject_type: row.subject_type,
      updated_at: timestamp(row.updated_at),
      value_type: row.value_type,
    })
  );
}
for (const row of rows("sports_events")) {
  output.push(
    insert("sports_events", {
      away_participant_id: row.away_participant_id
        ? textId("participant", row.away_participant_id)
        : null,
      away_score: row.away_score,
      created_at: timestamp(row.created_at),
      home_participant_id: row.home_participant_id
        ? textId("participant", row.home_participant_id)
        : null,
      home_score: row.home_score,
      id: textId("event", row.id),
      last_synced_at: timestamp(row.last_synced_at),
      league_id: textId("league", row.league_id),
      next_poll_at: timestamp(row.starts_at),
      provider: row.provider,
      provider_event_id: row.provider_event_id,
      provider_payload: row.provider_payload_json,
      starts_at: timestamp(row.starts_at),
      status: row.status,
      updated_at: timestamp(row.updated_at),
    })
  );
}
for (const row of rows("historical_import_batches")) {
  output.push(
    insert("historical_import_batches", {
      completed_at: timestamp(row.completed_at),
      created_at: timestamp(row.created_at),
      duplicate_count: row.duplicate_count,
      failed_count: row.failed_count,
      id: textId("batch", row.id),
      idempotency_key: `laravel:batch:${String(row.id)}`,
      needs_review_count: row.needs_review_count,
      processed_files: row.processed_files,
      status: row.status,
      total_files: row.total_files,
      updated_at: timestamp(row.updated_at),
      user_id: textId("user", row.user_id),
      verified_count: row.verified_count,
    })
  );
}
for (const row of rows("uploads")) {
  output.push(
    insert("uploads", {
      ai_model: row.ai_model,
      ai_response_version: row.ai_response_version,
      created_at: timestamp(row.created_at),
      file_size: row.file_size,
      id: textId("upload", row.id),
      ingestion_mode: "historical",
      mime_type: row.mime_type,
      object_key: `legacy/${String(row.storage_path)}`,
      original_filename: row.original_filename,
      sha256: row.sha256,
      status:
        row.processing_status === "pending" ? "ready" : row.processing_status,
      updated_at: timestamp(row.updated_at),
      usage_reservation_key: `laravel:upload:${String(row.id)}`,
      user_id: textId("user", row.user_id),
    })
  );
}
for (const row of rows("extractions")) {
  output.push(
    insert("extractions", {
      created_at: timestamp(row.created_at),
      error_message: row.error_message,
      id: textId("extraction", row.id),
      model: row.model,
      normalized_response: row.normalized_response_json,
      provider: row.provider,
      raw_response: row.raw_response_json,
      schema_version: row.schema_version,
      status: row.status,
      updated_at: timestamp(row.updated_at),
      upload_id: textId("upload", row.upload_id),
    })
  );
}
for (const row of rows("tickets")) {
  output.push(
    insert("tickets", {
      confirmed_at: timestamp(row.confirmed_at),
      created_at: timestamp(row.created_at),
      historical_import_batch_id: row.historical_import_batch_id
        ? textId("batch", row.historical_import_batch_id)
        : null,
      id: textId("ticket", row.id),
      ingestion_mode: row.ingestion_mode,
      result_source: row.result_source,
      settled_at: timestamp(row.settled_at),
      source_name: row.source_name,
      status: row.status,
      ticket_type: row.ticket_type,
      tracking_started_at: timestamp(row.tracking_started_at),
      updated_at: timestamp(row.updated_at),
      user_id: textId("user", row.user_id),
      verification_status: row.verification_status,
      verified_at: timestamp(row.verified_at),
      version: 1,
    })
  );
}
const legacyLegs = rows("ticket_legs");
const legacyLegById = new Map(legacyLegs.map((row) => [String(row.id), row]));
for (const row of legacyLegs) {
  output.push(
    insert("ticket_legs", {
      created_at: timestamp(row.created_at),
      current_value: row.current_value,
      display_description: row.display_description,
      event_hint: row.event_hint_json,
      id: textId("leg", row.id),
      league_id: row.league_id ? textId("league", row.league_id) : null,
      lost_at: timestamp(row.lost_at),
      market_id: row.market_id ? textId("market", row.market_id) : null,
      operator: row.operator,
      participant_id: row.participant_id
        ? textId("participant", row.participant_id)
        : null,
      raw_description: row.raw_description,
      resolver_confidence: row.resolver_confidence,
      resolver_status: row.resolver_status,
      secondary_target_value: row.secondary_target_value,
      settled_at: timestamp(row.settled_at),
      sport_id: row.sport_id ? textId("sport", row.sport_id) : null,
      sports_event_id: row.sports_event_id
        ? textId("event", row.sports_event_id)
        : null,
      status: row.status,
      subject_name: row.subject_name,
      subject_type: row.subject_type,
      target_value: row.target_value,
      ticket_id: textId("ticket", row.ticket_id),
      updated_at: timestamp(row.updated_at),
      version: 1,
      won_at: timestamp(row.won_at),
    })
  );
}
for (const row of rows("tracking_subscriptions")) {
  const leg = legacyLegById.get(String(row.ticket_leg_id));
  const marketId = row.market_id ?? leg?.market_id;
  if (!(marketId && row.sports_event_id)) {
    continue;
  }
  const participantId = row.participant_id ?? leg?.participant_id;
  output.push(
    insert("tracking_subscriptions", {
      created_at: timestamp(row.created_at),
      id: textId("tracking", row.id),
      market_id: textId("market", marketId),
      participant_id: participantId
        ? textId("participant", participantId)
        : null,
      sports_event_id: textId("event", row.sports_event_id),
      status: row.status,
      subscription_key: `laravel:${String(row.id)}`,
      ticket_leg_id: textId("leg", row.ticket_leg_id),
      updated_at: timestamp(row.updated_at),
    })
  );
}
for (const row of rows("stat_observations")) {
  output.push(
    insert("stat_observations", {
      created_at: timestamp(row.created_at),
      idempotency_key: `laravel:observation:${String(row.id)}`,
      market_id: textId("market", row.market_id),
      metadata: row.metadata_json,
      observed_at: timestamp(row.observed_at),
      participant_id: row.participant_id
        ? textId("participant", row.participant_id)
        : null,
      provider: row.provider,
      provider_sequence: String(row.provider_sequence ?? row.id),
      sports_event_id: textId("event", row.sports_event_id),
      value: row.value,
    })
  );
}
for (const row of rows("ticket_timeline_events")) {
  output.push(
    insert("ticket_timeline_events", {
      created_at: timestamp(row.created_at),
      id: textId("timeline", row.id),
      message: row.message,
      metadata: row.metadata_json,
      occurred_at: timestamp(row.occurred_at),
      ticket_id: textId("ticket", row.ticket_id),
      ticket_leg_id: row.ticket_leg_id
        ? textId("leg", row.ticket_leg_id)
        : null,
      title: row.title,
      transition_key: `laravel:${String(row.id)}`,
      type: row.type,
    })
  );
}
for (const row of rows("notification_preferences")) {
  output.push(
    insert("notification_preferences", {
      email_enabled: row.email,
      in_app_enabled: row.in_app,
      leg_lost: row.leg_lost,
      leg_won: row.leg_won,
      push_enabled: 1,
      ticket_lost: row.ticket_settled,
      ticket_won: row.ticket_settled,
      updated_at: timestamp(row.updated_at),
      user_id: textId("user", row.user_id),
    })
  );
}
for (const row of rows("notifications")) {
  const data = jsonRecord(row.data);
  output.push(
    insert("notifications", {
      body: data.message ?? data.body ?? "Notification",
      created_at: timestamp(row.created_at),
      data: row.data,
      id: textId("notification", row.id),
      milestone_key: `laravel:${String(row.id)}`,
      read_at: timestamp(row.read_at),
      ticket_id: data.ticket_id ? textId("ticket", data.ticket_id) : null,
      title: data.title ?? "ParlayPal update",
      type: data.type ?? row.type,
      user_id: textId("user", row.notifiable_id),
    })
  );
}
for (const row of rows("referrals")) {
  output.push(
    insert("referrals", {
      claimed_at: timestamp(row.created_at),
      code: row.referral_code,
      completed_at: timestamp(row.qualified_at ?? row.rewarded_at),
      created_at: timestamp(row.created_at),
      id: textId("referral", row.id),
      referred_user_id: row.referred_user_id
        ? textId("user", row.referred_user_id)
        : null,
      referrer_user_id: textId("user", row.referrer_user_id),
      request_key: `laravel:referral:${String(row.id)}`,
      status: referralStatus(row.status),
    })
  );
}
for (const row of rows("follows")) {
  output.push(
    insert("follows", {
      created_at: timestamp(row.created_at),
      followed_user_id: textId("user", row.followed_user_id),
      follower_user_id: textId("user", row.follower_user_id),
      id: textId("follow", row.id),
    })
  );
}
for (const row of rows("usage_events")) {
  output.push(
    insert("usage_events", {
      created_at: timestamp(row.created_at),
      id: textId("usage", row.id),
      idempotency_key: row.idempotency_key,
      metadata: row.metadata,
      occurred_at: timestamp(row.occurred_at),
      period_end: timestamp(row.occurred_at) ?? Date.now(),
      period_start: timestamp(row.occurred_at) ?? Date.now(),
      quantity: row.quantity,
      resource_id: row.resource_id,
      resource_type: row.resource_type,
      status: row.status,
      type: row.type,
      updated_at: timestamp(row.updated_at),
      user_id: textId("user", row.user_id),
    })
  );
}
output.push("COMMIT;");
await Bun.write(outputPath, `${output.join("\n")}\n`);
source.close();
console.info(
  `Wrote ${output.length - 3} idempotent migration statements to ${outputPath}`
);
