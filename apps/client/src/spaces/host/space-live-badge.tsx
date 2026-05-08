import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { Box, StatusDot, Text } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceLiveBadgeProps = {
  spaceId: string;
};

/* eslint-disable lingui/no-unlocalized-strings -- RGBA tokens, not user-facing copy */
const PILL_BG = 'rgba(255,255,255,0.22)';
const PILL_TEXT = '#FFFFFF';
/* eslint-enable lingui/no-unlocalized-strings */

/**
 * "Live" pill that renders only while the space is still live (no `endedAt`).
 * Self-gated: returns `null` when the space has ended, so callers don't have
 * to branch on liveness.
 */
export function SpaceLiveBadge({ spaceId }: SpaceLiveBadgeProps): ReactNode {
  const endedAt = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.endedAt.key,

    parse: SpaceAttr.endedAt.parse,
  });
  const isLive = endedAt === null;
  if (!isLive) return null;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        backgroundColor: PILL_BG,
        borderRadius: 999,
        px: 2,
        py: 1,
        alignSelf: 'flex-start',
      }}
    >
      <StatusDot status="online" size={8} />
      <Text
        variant="caption"
        sx={{ color: PILL_TEXT }}
        label={<Trans>Live</Trans>}
      />
    </Box>
  );
}
