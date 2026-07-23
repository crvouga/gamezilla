import type { SpaceVisibility } from '../space-visibility';
import type { SpacesError } from '../spaces-errors';
import { resolveSpaceMemberId } from './participation-ids';

export type SpaceAccessDecision =
  | {
      readonly allowed: true;
      readonly reason: 'open' | 'invite' | 'friend' | 'host' | 'already';
    }
  | { readonly allowed: false; readonly code: SpacesError['code'] };

export type SpaceAccessInput = {
  readonly visibility: SpaceVisibility;
  readonly hostId: string;
  readonly hostAccountId: string | null;
  readonly hostMemberId: string;
  readonly viewerAccountId: string | null;
  readonly viewerDeviceId: string;
  readonly viewerMemberId: string;
  readonly isFriendOfHost: boolean;
  readonly hasValidInvite: boolean;
  /** Viewer already has an active user membership. */
  readonly alreadyMember: boolean;
  /** This install already has an active participation. */
  readonly alreadyParticipating: boolean;
};

export type LeaveDeviceDecision = {
  readonly leaveParticipation: boolean;
  readonly leaveMembership: boolean;
};

export type LeaveEverywhereDecision = {
  readonly leaveAllParticipations: true;
  readonly leaveMembership: true;
};

export type EndSpaceDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: 'SPACE_HOST_REQUIRED' };

export type PresenceRole = 'host' | 'guest';

export type RosterParticipation = {
  readonly memberId: string;
  readonly deviceId: string;
  readonly leftAt: string | null;
};

export type RosterMember = {
  readonly memberId: string;
  readonly deviceIds: readonly string[];
};

/**
 * Canonical member id for writes / room / game identity.
 * Same as {@link resolveSpaceMemberId}.
 */
export function resolveMemberId(args: {
  readonly accountId: string | null;
  readonly deviceId: string;
}): string {
  return resolveSpaceMemberId(args);
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
  if (input.hasValidInvite) {
    return { allowed: true, reason: 'invite' };
  }
  if (input.visibility === 'private') {
    return { allowed: false, code: 'SPACE_VISIBILITY_DENIED' };
  }
  if (input.viewerAccountId === null) {
    return { allowed: false, code: 'SPACE_NOT_SIGNED_IN' };
  }
  if (input.visibility === 'public') {
    return { allowed: true, reason: 'open' };
  }
  if (
    input.hostAccountId !== null &&
    (input.viewerAccountId === input.hostAccountId || input.isFriendOfHost)
  ) {
    return { allowed: true, reason: 'friend' };
  }
  return { allowed: false, code: 'SPACE_VISIBILITY_DENIED' };
}

/**
 * Whether the viewer may join (or add a device participation to) a live space.
 *
 * Space owners (member / creating device / host account) may always rejoin.
 * Idempotent re-join of an existing participation is allowed.
 */
export function decideJoin(input: SpaceAccessInput): SpaceAccessDecision {
  if (input.alreadyParticipating) {
    return { allowed: true, reason: 'already' };
  }
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

/**
 * Leave this device's participation. Soft-leave membership only when this
 * was the member's last active participation.
 */
export function decideLeaveDevice(args: {
  readonly hasOtherActiveParticipations: boolean;
}): LeaveDeviceDecision {
  return {
    leaveParticipation: true,
    leaveMembership: !args.hasOtherActiveParticipations,
  };
}

/** Leave every device participation and the user membership. */
export function decideLeaveEverywhere(): LeaveEverywhereDecision {
  return { leaveAllParticipations: true, leaveMembership: true };
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

/** Room / game actor id is the member id (account or anon device). */
export function resolveRoomActorId(args: {
  readonly accountId: string | null;
  readonly deviceId: string;
}): string {
  return resolveMemberId(args);
}

/**
 * Collapse device participations into unique members for roster / game seating.
 * Inactive (`leftAt` set) rows are ignored.
 */
export function collapseRoster(
  participations: readonly RosterParticipation[]
): readonly RosterMember[] {
  const byMember = new Map<string, string[]>();
  for (const row of participations) {
    if (row.leftAt !== null) continue;
    if (row.memberId.length === 0 || row.deviceId.length === 0) continue;
    const devices = byMember.get(row.memberId);
    if (devices === undefined) {
      byMember.set(row.memberId, [row.deviceId]);
    } else if (!devices.includes(row.deviceId)) {
      devices.push(row.deviceId);
    }
  }
  return Array.from(byMember.entries()).map(([memberId, deviceIds]) => ({
    memberId,
    deviceIds,
  }));
}

/**
 * Whether joining should consume an invite use.
 * Only when creating/reactivating a *user* membership (not adding another device).
 */
export function shouldConsumeInviteOnJoin(args: {
  readonly membershipWasInactive: boolean;
  readonly hasInviteToken: boolean;
}): boolean {
  return args.membershipWasInactive && args.hasInviteToken;
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
