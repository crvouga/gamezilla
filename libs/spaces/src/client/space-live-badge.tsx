import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { borderRadius, Box, StatusDot, Text } from '@pkgs/ui';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceLiveBadgeProps = {
  spaceId: string;
};

/**
 * "Live" pill that renders only while the space is still live (no `endedAt`).
 * Self-gated: returns `null` when the space has ended, so callers don't have
 * to branch on liveness.
 */
export function SpaceLiveBadge({ spaceId }: SpaceLiveBadgeProps): ReactNode {
  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.endedAt,
  });
  const isLive = endedAt === null;
  if (!isLive) return null;
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
