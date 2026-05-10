import { SpaceHostNameText } from './space-host-name-text';
import { Box, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceJoinHostSectionProps = {
  spaceId: string;
};

/** Host label + host display name for the join screen. */
export function SpaceJoinHostSection({
  spaceId,
}: SpaceJoinHostSectionProps): ReactNode {
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Host</Trans>}
      />
      <SpaceHostNameText spaceId={spaceId} variant="bodyBold" />
    </Box>
  );
}
