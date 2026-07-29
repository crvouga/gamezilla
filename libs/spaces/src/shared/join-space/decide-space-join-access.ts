/**
 * Prefer {@link decideJoin} from `participation/space-participation-policy`.
 * Thin adapter for call sites that only need visibility / allowlist ABAC.
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
  readonly hostId: string;
  readonly hostAccountId: string | null;
  readonly hostMemberId: string;
  readonly viewerAccountId: string | null;
  readonly viewerDeviceId: string;
  readonly viewerMemberId: string;
  readonly isAllowlisted: boolean;
  readonly alreadyMember?: boolean;
};

/**
 * Decides whether a viewer may join a live space.
 * Public requires a signed-in account; private requires allow-list.
 * Space owners (member / creating device / host account) may always rejoin.
 */
export function decideSpaceJoinAccess(
  input: SpaceAccessInput
): SpaceAccessDecision {
  if (input.viewerAccountId === null || input.viewerAccountId.length === 0) {
    return { allowed: false, code: 'SPACE_NOT_SIGNED_IN' };
  }
  return decideJoin({
    visibility: input.visibility,
    hostId: input.hostId,
    hostAccountId: input.hostAccountId,
    hostMemberId: input.hostMemberId,
    viewerAccountId: input.viewerAccountId,
    viewerDeviceId: input.viewerDeviceId,
    viewerMemberId: input.viewerMemberId,
    isAllowlisted: input.isAllowlisted,
    alreadyMember: input.alreadyMember ?? false,
  });
}

export type { SpacesError };
