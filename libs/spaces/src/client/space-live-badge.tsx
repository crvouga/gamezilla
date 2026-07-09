import { borderRadius, Box, StatusDot, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import { useSpaceColumn, SpaceField } from './use-space-column';

export type SpaceLiveBadgeProps = {
  spaceId: string;
};

/** "Live" pill — renders only while the space has no ended_at. */
export function SpaceLiveBadge({ spaceId }: SpaceLiveBadgeProps): ReactNode {
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  if (endedAt !== null) return null;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        backgroundColor: 'onTintScrim',
        borderRadius: borderRadius.full,
        px: 2,
        py: 1,
        alignSelf: 'flex-start',
      }}
    >
      <StatusDot status="online" size={8} />
      <Text
        variant="caption"
        sx={{ color: 'onTint' }}
        label={<Trans>Live</Trans>}
      />
    </Box>
  );
}
