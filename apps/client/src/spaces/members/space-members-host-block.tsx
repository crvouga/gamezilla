import { SpaceMemberTileRail } from '@gamezilla/client/spaces/members/space-member-tile-rail';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { Box, Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceMembersHostBlockProps = {
  spaceId: string;
};

/**
 * Section showing the host's tile (or a "no host listed" placeholder).
 * Resolves the host id inline.
 */
export function SpaceMembersHostBlock({
  spaceId,
}: SpaceMembersHostBlockProps): ReactNode {
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.hostId.key,

    parse: SpaceAttr.hostId.parse,
  });
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', px: 2 }}
        label={<Trans>Host</Trans>}
      />
      <Box sx={{ gap: 0 }}>
        {hostId !== null ? (
          <SpaceMemberTileRail spaceId={spaceId} profileId={hostId} />
        ) : (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', px: 2 }}
            label={<Trans>No host listed</Trans>}
          />
        )}
      </Box>
    </Box>
  );
}
