import { Trans } from '@lingui/react/macro';
import { Box, borderRadius, StatusDot, Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { useIsSpaceOpenLocally } from '../use-cases/list-open-sessions/client/use-open-space-session-ids';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceLiveBadgeProps = {
  spaceId: string;
};

function SpaceStatusPill({
  label,
  showDot,
}: {
  readonly label: ReactNode;
  readonly showDot: boolean;
}): ReactNode {
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
      {showDot ? <StatusDot status="online" size={8} /> : null}
      <Text variant="caption" sx={{ color: 'onPrimary' }} label={label} />
    </Box>
  );
}

/**
 * Status pill on space cards — "Current" when this device has the space open
 * (miniplayer), otherwise "Live" while the space has not ended.
 */
export function SpaceLiveBadge({ spaceId }: SpaceLiveBadgeProps): ReactNode {
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  const isOpen = useIsSpaceOpenLocally(spaceId);
  if (endedAt !== null) return null;
  if (isOpen) {
    return <SpaceStatusPill label={<Trans>Current</Trans>} showDot={false} />;
  }
  return <SpaceStatusPill label={<Trans>Live</Trans>} showDot />;
}
