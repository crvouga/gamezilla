import { useSpaceGuestMembershipIds } from '@gamezilla/client/spaces/guests/use-space-guest-membership-ids';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { JsonView } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceDebugMembersSectionProps = {
  spaceId: string;
};

/** Member ids snapshot for the space debug modal. */
export function SpaceDebugMembersSection({
  spaceId,
}: SpaceDebugMembersSectionProps): ReactNode {
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.hostId.key,

    parse: SpaceAttr.hostId.parse,
  });
  const guestMembershipIds = useSpaceGuestMembershipIds(spaceId);
  return (
    <JsonView
      label={<Trans>members</Trans>}
      value={{ hostId, guestMembershipIds }}
    />
  );
}
