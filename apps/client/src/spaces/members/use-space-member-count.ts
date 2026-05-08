import { useSpaceGuestMembershipIds } from '@gamezilla/client/spaces/guests/use-space-guest-membership-ids';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';

/**
 * Total member count for a space: 1 for the host (when known) plus the
 * number of active guest membership rows.
 *
 * Combines two queries (`space/hostId` + guest membership ids) which is why
 * it earns a wrapper hook rather than being inlined per-atom.
 */
export function useSpaceMemberCount(spaceId: string): number {
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.hostId.key,

    parse: SpaceAttr.hostId.parse,
  });
  const guests = useSpaceGuestMembershipIds(spaceId);
  return (hostId !== null ? 1 : 0) + guests.length;
}
