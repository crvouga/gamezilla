import { SpaceMemberTileRail } from './space-member-tile-rail';
import { Box, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';

export type SpaceMembersHostBlockProps = {
  spaceId: string;
};

export function SpaceMembersHostBlock({
  spaceId,
}: SpaceMembersHostBlockProps): ReactNode {
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
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
