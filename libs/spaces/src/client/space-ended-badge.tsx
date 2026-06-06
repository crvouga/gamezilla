import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { borderRadius, Box, StatusDot, Text } from '@pkgs/ui';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceEndedBadgeProps = {
  spaceId: string;
};

export function SpaceEndedBadge({ spaceId }: SpaceEndedBadgeProps): ReactNode {
  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.endedAt,
  });
  if (endedAt === null) return null;
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
      <StatusDot status="offline" size={8} />
      <Text
        variant="caption"
        sx={{ color: 'onTint' }}
        label={<Trans>Ended</Trans>}
      />
    </Box>
  );
}
