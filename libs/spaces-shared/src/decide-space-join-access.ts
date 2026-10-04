/**
 * Prefer {@link decideJoin} from `participation/space-participation-policy`.
 * Thin adapter for call sites that only need visibility / ACL ABAC.
 */

import type { SpaceAccessDecision } from './space-participation-policy';
import { decideJoin } from './space-participation-policy';
import type { SpaceVisibility } from './space-visibility';

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
