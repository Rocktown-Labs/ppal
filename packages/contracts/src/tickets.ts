import { z } from "zod";

export const uploadStatuses = [
  "pending",
  "uploading",
  "ready",
  "processing",
  "extracted",
  "failed",
] as const;

export const ticketStatuses = [
  "draft",
  "needs_review",
  "scheduled",
  "live",
  "won",
  "lost",
  "push",
  "void",
  "partially_void",
  "settled",
] as const;

export const ticketLegStatuses = [
  "pending",
  "live",
  "won",
  "lost",
  "push",
  "void",
  "cancelled",
  "unresolved",
] as const;

export const sportsEventStatuses = [
  "scheduled",
  "live",
  "final",
  "postponed",
  "cancelled",
] as const;

export const resolverStatuses = [
  "resolved",
  "ambiguous",
  "not_found",
  "unsupported",
] as const;

export const verificationStatuses = [
  "unverified",
  "partially_verified",
  "verified",
] as const;

export const resultSources = [
  "live_provider",
  "historical_provider",
  "settled_slip",
  "manual",
] as const;

export const ingestionModes = ["live", "historical"] as const;

export const ticketLegOperators = [
  "over",
  "under",
  "gte",
  "lte",
  "equals",
  "moneyline",
  "spread",
  "yes",
  "no",
  "custom",
] as const;

export const uploadStatusSchema = z.enum(uploadStatuses);
export const ticketStatusSchema = z.enum(ticketStatuses);
export const ticketLegStatusSchema = z.enum(ticketLegStatuses);
export const sportsEventStatusSchema = z.enum(sportsEventStatuses);
export const resolverStatusSchema = z.enum(resolverStatuses);
export const verificationStatusSchema = z.enum(verificationStatuses);
export const resultSourceSchema = z.enum(resultSources);
export const ingestionModeSchema = z.enum(ingestionModes);
export const ticketLegOperatorSchema = z.enum(ticketLegOperators);

export const ticketLegContractSchema = z.object({
  currentValue: z.number().nullable(),
  displayDescription: z.string().nullable(),
  id: z.string().min(1),
  leagueId: z.string().min(1).nullable(),
  lostAt: z.string().datetime().nullable(),
  marketComponents: z.array(z.string()),
  marketId: z.string().min(1).nullable(),
  operator: ticketLegOperatorSchema,
  participantId: z.string().min(1).nullable(),
  rawDescription: z.string(),
  resolverConfidence: z.number().min(0).max(1).nullable(),
  resolverStatus: resolverStatusSchema,
  secondaryTargetValue: z.number().nullable(),
  settledAt: z.string().datetime().nullable(),
  sportId: z.string().min(1).nullable(),
  sportsEventId: z.string().min(1).nullable(),
  status: ticketLegStatusSchema,
  subjectName: z.string().min(1),
  subjectType: z.enum(["player", "team", "game"]),
  targetValue: z.number().nullable(),
  ticketId: z.string().min(1),
  wonAt: z.string().datetime().nullable(),
});

export const ticketContractSchema = z.object({
  confirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  displayedResult: z.enum(["won", "lost", "push", "void"]).nullable(),
  id: z.string().min(1),
  ingestionMode: ingestionModeSchema,
  legs: z.array(ticketLegContractSchema),
  resultSource: resultSourceSchema.nullable(),
  settledAt: z.string().datetime().nullable(),
  sourceName: z.string().nullable(),
  sourceUploadId: z.string().min(1).nullable(),
  status: ticketStatusSchema,
  ticketType: z.enum(["parlay", "single", "sgp", "teaser", "round_robin"]),
  trackingStartedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  verificationStatus: verificationStatusSchema,
  verifiedAt: z.string().datetime().nullable(),
});

export const reviewTicketLegSchema = z.object({
  displayDescription: z.string().trim().min(1).max(500),
  id: z.string().min(1),
  leagueId: z.string().min(1).nullable(),
  marketId: z.string().min(1).nullable(),
  operator: ticketLegOperatorSchema,
  participantId: z.string().min(1).nullable(),
  secondaryTargetValue: z.number().finite().nullable(),
  sportId: z.string().min(1).nullable(),
  sportsEventId: z.string().min(1).nullable(),
  subjectName: z.string().trim().min(1).max(160),
  subjectType: z.enum(["player", "team", "game"]),
  targetValue: z.number().finite().nullable(),
});

export const reviewTicketRequestSchema = z.object({
  legs: z.array(reviewTicketLegSchema).min(1).max(50),
});

export type IngestionMode = z.infer<typeof ingestionModeSchema>;
export type ResolverStatus = z.infer<typeof resolverStatusSchema>;
export type ResultSource = z.infer<typeof resultSourceSchema>;
export type SportsEventStatus = z.infer<typeof sportsEventStatusSchema>;
export type TicketContract = z.infer<typeof ticketContractSchema>;
export type TicketLegContract = z.infer<typeof ticketLegContractSchema>;
export type TicketLegOperator = z.infer<typeof ticketLegOperatorSchema>;
export type TicketLegStatus = z.infer<typeof ticketLegStatusSchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type UploadStatus = z.infer<typeof uploadStatusSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
