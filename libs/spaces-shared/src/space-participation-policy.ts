import type { SpaceVisibility } from './space-visibility';
import type { SpacesError } from './spaces-errors';
import { resolveSpaceMemberId } from './participation-ids';

export type SpaceAccessDecision =
  | {
      readonly allowed: true;
      readonly reason: 'open' | 'space_user' | 'host' | 'already' | 'friend';
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
  /** Viewer already has a spaces_users ACL row. */
  readonly hasSpaceUser: boolean;
  /** Viewer is friends with the space host. */
  readonly isFriendOfHost: boolean;
};

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
  if (input.hasSpaceUser) {
    return { allowed: true, reason: 'space_user' };
  }
  if (input.isFriendOfHost) {
    return { allowed: true, reason: 'friend' };
  }
  return { allowed: false, code: 'SPACE_VISIBILITY_DENIED' };
}

/**
 * Whether the viewer may open a live space.
 *
 * Space owners (member / creating device / host account) may always reopen.
 * Existing ACL (`spaces_users`) may reopen. Public is open to anyone
 * (self-grant on join). Private requires an ACL row, friendship with the host,
 * or host identity.
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
  if (input.hasSpaceUser) {
    return { allowed: true, reason: 'already' };
  }
  return decideJoinVisibility(input);
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
