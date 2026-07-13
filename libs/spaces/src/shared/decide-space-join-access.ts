import type { SpaceVisibility } from './space-visibility';
import type { SpacesError } from './spaces-errors';

export type SpaceAccessDecision =
  | {
      readonly allowed: true;
      readonly reason: 'open' | 'invite' | 'friend' | 'host';
    }
  | { readonly allowed: false; readonly code: SpacesError['code'] };

export type SpaceAccessInput = {
  readonly visibility: SpaceVisibility;
  readonly hostAccountId: string | null;
  readonly viewerAccountId: string | null;
  readonly viewerIsHostDevice: boolean;
  readonly isFriendOfHost: boolean;
  readonly hasValidInvite: boolean;
};

/**
 * Decides whether a viewer may join a live space.
 * Public/friends require a signed-in account; private requires a valid invite.
 */
export function decideSpaceJoinAccess(
  input: SpaceAccessInput
): SpaceAccessDecision {
  if (input.viewerIsHostDevice) {
    return { allowed: false, code: 'SPACE_HOST_ALREADY_MEMBER' };
  }
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
  // friends
  if (
    input.hostAccountId !== null &&
    (input.viewerAccountId === input.hostAccountId || input.isFriendOfHost)
  ) {
    return { allowed: true, reason: 'friend' };
  }
  return { allowed: false, code: 'SPACE_VISIBILITY_DENIED' };
}
