/**
 * Community authorization rules shared by the REST routes.
 *
 * `visibility` controls discovery: a public community can be viewed by anyone,
 * while a private community is only visible to active members. `access`
 * controls whether the community's content (channels and messages) is free or
 * paid. Paid content is always members-only, even when the community itself is
 * publicly discoverable.
 */

export type CommunityAccess = "free" | "paid";
export type CommunityVisibility = "public" | "private";
export type CommunityMemberStatus = "active" | "pending" | "muted" | "banned";

export interface CommunityAccessRecord {
  access: CommunityAccess;
  visibility: CommunityVisibility;
}

export interface MembershipState {
  status: CommunityMemberStatus;
}

/**
 * Whether the community landing page (name, description, channel list) may be
 * shown. Paid public communities are discoverable so visitors can start a
 * checkout; their message history is still protected by
 * `canReadCommunityContent`.
 */
export const canViewCommunity = (
  community: CommunityAccessRecord,
  membership: MembershipState | null
): boolean =>
  community.visibility === "public" || membership?.status === "active";

/**
 * Whether the community's channels and message history may be read.
 *
 * Public free communities are readable by anyone. Paid communities and private
 * communities require an active membership, so a public paid community cannot
 * be used to bypass its paywall.
 */
export const canReadCommunityContent = (
  community: CommunityAccessRecord,
  membership: MembershipState | null
): boolean =>
  membership?.status === "active" ||
  (community.access === "free" && community.visibility === "public");

/**
 * Whether a member may remove their own membership. Banned and muted members
 * must keep their row: deleting it would let them rejoin (or replay a paid
 * checkout) as a fresh active member and erase the moderation decision.
 */
export const canLeaveCommunity = (
  membership: MembershipState | null
): boolean =>
  membership?.status === "active" || membership?.status === "pending";

/**
 * Whether a completed paid checkout may activate the caller's membership.
 * Banned and muted members are rejected so a stored checkout success URL
 * cannot be replayed to clear a moderation action.
 */
export const canActivatePaidMembership = (
  membership: MembershipState | null
): boolean =>
  !membership ||
  membership.status === "active" ||
  membership.status === "pending";
