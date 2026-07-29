import type { SpaceVisibility } from '../space-visibility';
import type { SpacesError } from '../spaces-errors';
import { resolveSpaceMemberId } from './participation-ids';

export type SpaceAccessDecision =
  | {
      readonly allowed: true;
      readonly reason: 'open' | 'allowlist' | 'host' | 'already';
    }
  | { readonly allowed: false; readonly code: SpacesError['code'] };

export type SpaceAccessInput = {
  readonly visibility: SpaceVisibility;
  readonly hostId: string;
  readonly hostAccountId: string | null;
  readonly hostMemberId: string;
  readonly viewerAccountId: string;
  readonly viewerDeviceId: string;
  readonly viewerMemberId: string;
  readonly isAllowlisted: boolean;
  /** Viewer already has an active user membership. */
  readonly alreadyMember: boolean;
};

export type EndSpaceDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: 'SPACE_HOST_REQUIRED' };

export type PresenceRole = 'host' | 'guest';

/**
 * Canonical member id for writes / room / game identity.
 * Same as {@link resolveSpaceMemberId}.
 */
export function resolveMemberId(accountId: string): string {
  return resolveSpaceMemberId(accountId);
}

export function isHostMember(args: {
  readonly hostMemberId: string;
  readonly memberId: string;
}): boolean {
  const host = args.hostMemberId ?? '';
  const member = args.memberId ?? '';
  return host.length > 0 && member.length > 0 && host === member;
}

function nonEmptyEqual(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && a === b;
}

/**
 * Whether the actor may act as space owner (join/end/rename), including
 * identity-drift cases where only `host_id` or `host_account_id` still match.
 * Distinct from {@link isHostMember}, which is for roster/presence role.
 */
export function isSpaceHostActor(args: {
  readonly hostId: string;
  readonly hostMemberId: string;
  readonly hostAccountId: string | null;
  readonly memberId: string;
  readonly accountId: string | null;
  readonly deviceId: string;
}): boolean {
  if (
    isHostMember({
      hostMemberId: args.hostMemberId,
      memberId: args.memberId,
    })
  ) {
    return true;
  }
  if (nonEmptyEqual(args.hostId ?? '', args.deviceId ?? '')) {
    return true;
  }
  return nonEmptyEqual(args.hostAccountId ?? '', args.accountId ?? '');
}

function decideJoinVisibility(input: SpaceAccessInput): SpaceAccessDecision {
  if (input.visibility === 'public') {
    return { allowed: true, reason: 'open' };
  }
  if (input.isAllowlisted) {
    return { allowed: true, reason: 'allowlist' };
  }
  return { allowed: false, code: 'SPACE_VISIBILITY_DENIED' };
}

/**
 * Whether the viewer may join a live space.
 *
 * Space owners (member / creating device / host account) may always rejoin.
 * Idempotent re-join of an existing membership is allowed.
 * Private spaces require allow-list membership.
 */
export function decideJoin(input: SpaceAccessInput): SpaceAccessDecision {
  if (
    isSpaceHostActor({
      hostId: input.hostId,
      hostMemberId: input.hostMemberId,
      hostAccountId: input.hostAccountId,
      memberId: input.viewerMemberId,
      accountId: input.viewerAccountId,
      deviceId: input.viewerDeviceId,
    })
  ) {
    return { allowed: true, reason: 'host' };
  }
  if (input.alreadyMember) {
    return { allowed: true, reason: 'already' };
  }
  return decideJoinVisibility(input);
}

export function decideEndSpace(args: {
  readonly isHostActor: boolean;
}): EndSpaceDecision {
  if (!args.isHostActor) {
    return { allowed: false, code: 'SPACE_HOST_REQUIRED' };
  }
  return { allowed: true };
}

export function resolvePresenceRole(args: {
  readonly hostMemberId: string;
  readonly memberId: string;
}): PresenceRole {
  return isHostMember(args) ? 'host' : 'guest';
}

/** Room / game actor id is the member (account) id. */
export function resolveRoomActorId(accountId: string): string {
  return resolveMemberId(accountId);
}

/**
 * Whether active_member_count should bump on join.
 * Only when creating/reactivating a user membership.
 */
export function shouldBumpMemberCountOnJoin(args: {
  readonly membershipWasInactive: boolean;
}): boolean {
  return args.membershipWasInactive;
}
