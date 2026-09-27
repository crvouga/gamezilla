/**
 * Prefer {@link decideJoin} from `participation/space-participation-policy`.
 * Thin adapter for call sites that only need visibility / ACL ABAC.
 */

import {
  decideJoin,
  type SpaceAccessDecision,
} from '../../../shared/space/participation/space-participation-policy';
import type { SpaceVisibility } from '../../../shared/space/space-visibility';
import type { SpacesError } from '../../../shared/space/spaces-errors';

export type { SpaceAccessDecision };

export type SpaceAccessInput = {
  readonly visibility: SpaceVisibility;
  readonly hostId: string;
  readonly hostAccountId: string | null;
  readonly hostMemberId: string;
  readonly viewerAccountId: string | null;
  readonly viewerDeviceId: string;
  readonly viewerMemberId: string;
  readonly hasSpaceUser: boolean;
  readonly isFriendOfHost: boolean;
};

/**
 * Decides whether a viewer may open a live space.
 * Public is open to anyone; private requires the spaces_users ACL.
 * Space owners (member / creating device / host account) may always reopen.
 */
export function decideSpaceJoinAccess(
  input: SpaceAccessInput
): SpaceAccessDecision {
  return decideJoin({
    visibility: input.visibility,
    hostId: input.hostId,
    hostAccountId: input.hostAccountId,
    hostMemberId: input.hostMemberId,
    viewerAccountId: input.viewerAccountId,
    viewerDeviceId: input.viewerDeviceId,
    viewerMemberId: input.viewerMemberId,
    hasSpaceUser: input.hasSpaceUser,
    isFriendOfHost: input.isFriendOfHost,
  });
}

export type { SpacesError };
