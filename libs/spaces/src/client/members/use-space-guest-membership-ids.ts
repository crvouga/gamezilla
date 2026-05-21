import {
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';
import { useQueryEntityIds } from '@pkgs/patch-db/react';

/**
 * Membership entity ids for active guests of a space, ordered by `joinedAt`.
 * Returns an empty list when `spaceId` is empty (caller passes `''` to
 * disable, e.g. while the route param is missing).
 *
 * Atoms iterate these ids and render `<SpaceGuestMembershipAvatar
 * membershipId />` etc.; each atom resolves the guest profile id itself.
 */
export function useSpaceGuestMembershipIds(spaceId: string): string[] {
  const enabled = spaceId.length > 0;
  const args: Parameters<typeof useQueryEntityIds>[0] = enabled
    ? {
        entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
        where: {
          type: 'and',
          clauses: [
            {
              type: '=',
              attribute: SpaceMembershipAttr.spaceId.key,
              value: spaceId,
            },
            { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt.key },
          ],
        },
        orderBy: [
          { attribute: SpaceMembershipAttr.joinedAt.key, direction: 'asc' },
        ],
      }
    : { entityType: SPACE_MEMBERSHIP_ENTITY_TYPE, limit: 0 };
  return useQueryEntityIds(args);
}
