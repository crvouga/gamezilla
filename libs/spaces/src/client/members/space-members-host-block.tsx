import { SpaceMemberTileRail } from './space-member-tile-rail';
import { Box, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceMembersHostBlockProps = {
  spaceId: string;
};

export function SpaceMembersHostBlock({
  spaceId,
}: SpaceMembersHostBlockProps): ReactNode {
  const host = useSpaceHostMembershipDisplay(spaceId);
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', px: 2 }}
        label={<Trans>Host</Trans>}
      />
      <Box sx={{ gap: 0 }}>
        {host !== null ? (
          <SpaceMemberTileRail
            spaceId={spaceId}
            deviceId={host.deviceId}
            profileId={host.profileId}
            deviceLabel={host.deviceLabel}
          />
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
