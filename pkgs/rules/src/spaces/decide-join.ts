import { isSpaceHostActor } from './host-actor';

export type JoinVisibility = 'public' | 'private';

export type JoinDecision =
  | {
      readonly allowed: true;
      readonly reason: 'open' | 'space_user' | 'host' | 'already';
    }
  | {
      readonly allowed: false;
      readonly code: 'SPACE_NOT_SIGNED_IN' | 'SPACE_VISIBILITY_DENIED';
    };

export type JoinInput = {
  readonly visibility: JoinVisibility;
  readonly hostId: string;
  readonly hostAccountId: string | null;
  readonly hostMemberId: string;
  readonly viewerAccountId: string | null;
  readonly viewerDeviceId: string;
  readonly viewerMemberId: string;
  readonly hasSpaceUser: boolean;
};

function decideJoinVisibility(input: JoinInput): JoinDecision {
  if (input.visibility === 'public') {
    return { allowed: true, reason: 'open' };
  }
  if (input.hasSpaceUser) {
    return { allowed: true, reason: 'space_user' };
  }
  return { allowed: false, code: 'SPACE_VISIBILITY_DENIED' };
}

/**
 * Bug-for-bug port of spaces `decideJoin` / `decideSpaceJoinAccess`.
 */
export function decideSpaceJoinAccess(input: JoinInput): JoinDecision {
  if (input.viewerAccountId === null || input.viewerAccountId.length === 0) {
    return { allowed: false, code: 'SPACE_NOT_SIGNED_IN' };
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
  if (input.hasSpaceUser) {
    return { allowed: true, reason: 'already' };
  }
  return decideJoinVisibility(input);
}
