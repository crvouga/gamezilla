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
    attributeKey: SpaceAttr.title.key,

    parse: SpaceAttr.title.parse,
  });
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.hostId.key,

    parse: SpaceAttr.hostId.parse,
  });
  const createdAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.createdAt.key,

    parse: SpaceAttr.createdAt.parse,
  });
  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.endedAt.key,

    parse: SpaceAttr.endedAt.parse,
  });
  const live = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.endedAt.key,

    parse: SpaceAttr.endedAt.parse,
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
