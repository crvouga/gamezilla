import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { JsonView } from '@gamezilla/lib/ui';
import { useQuery, useQueryAttribute } from '@gamezilla/patch-db/react';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceDebugSpaceSectionProps = {
  spaceId: string;
};

/** Space-entity snapshot for the space debug modal. */
export function SpaceDebugSpaceSection({
  spaceId,
}: SpaceDebugSpaceSectionProps): ReactNode {
  const customTitle = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.title,
  });
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.hostId,
  });
  const createdAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.createdAt,
  });
  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.endedAt,
  });
  const live = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.endedAt,
  });
  const res = useQuery({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    limit: 1,
  });
  const entity = res.entities[0] ?? null;

  const value = {
    customTitle,
    hostId,
    createdAt,
    endedAt,
    live,
    isLoading: res.isLoading,
    entity,
  };
  return <JsonView label={<Trans>space</Trans>} value={value} />;
}
