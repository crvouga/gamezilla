/**
 * @deprecated Prefer {@link decideJoin} from
 * `participation/space-participation-policy`. Kept as a thin adapter for
 * call sites that only need visibility / invite ABAC without participation
 * state.
 */
import type { SpaceVisibility } from '../space-visibility';
import type { SpacesError } from '../spaces-errors';
import {
  decideJoin,
  type SpaceAccessDecision,
} from '../participation/space-participation-policy';

export type { SpaceAccessDecision };

export type SpaceAccessInput = {
  readonly visibility: SpaceVisibility;
  readonly hostAccountId: string | null;
  readonly hostMemberId: string;
  readonly viewerAccountId: string | null;
  readonly viewerMemberId: string;
  readonly isFriendOfHost: boolean;
  readonly hasValidInvite: boolean;
  readonly alreadyMember?: boolean;
  readonly alreadyParticipating?: boolean;
};

/**
 * Decides whether a viewer may join a live space.
 * Public/friends require a signed-in account; private requires a valid invite.
 * Host member on another device is allowed.
 */
export function decideSpaceJoinAccess(
  input: SpaceAccessInput
): SpaceAccessDecision {
  return decideJoin({
    visibility: input.visibility,
    hostAccountId: input.hostAccountId,
    hostMemberId: input.hostMemberId,
    viewerAccountId: input.viewerAccountId,
    viewerMemberId: input.viewerMemberId,
    isFriendOfHost: input.isFriendOfHost,
    hasValidInvite: input.hasValidInvite,
    alreadyMember: input.alreadyMember ?? false,
    alreadyParticipating: input.alreadyParticipating ?? false,
  });
}

export type { SpacesError };
