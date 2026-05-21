import { SpaceGuestAvatarGroup } from './space-guest-avatar-group';
import { SpaceGuestCountText } from './space-guest-count-text';
import { SpaceGuestNamesLine } from './space-guest-names-line';
import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type SpaceGuestSectionProps = {
  spaceId: string;
};

/* eslint-disable lingui/no-unlocalized-strings -- RGBA tokens, not user-facing copy */
const COUNT_COLOR = 'rgba(255,255,255,0.95)';
const NAMES_COLOR = 'rgba(255,255,255,0.9)';
/* eslint-enable lingui/no-unlocalized-strings */

const AVATAR_SIZE = 24;
const AVATAR_GROUP_RING = 'surface' as const;
const AVATAR_MAX_VISIBLE = 6;

/**
 * Pure layout: count line, avatar stack, and joined name list for the guests
 * of a space card. Each child resolves its own data from `spaceId`.
 */
export function SpaceGuestSection({
  spaceId,
}: SpaceGuestSectionProps): ReactNode {
  return (
    <Box sx={{ mt: 3, gap: 1.5 }}>
      <SpaceGuestCountText
        spaceId={spaceId}
        variant="caption"
        sx={{ color: COUNT_COLOR }}
      />
      <SpaceGuestAvatarGroup
        spaceId={spaceId}
        size={AVATAR_SIZE}
        maxVisible={AVATAR_MAX_VISIBLE}
        ringColor={AVATAR_GROUP_RING}
      />
      <SpaceGuestNamesLine
        spaceId={spaceId}
        variant="caption"
        sx={{ color: NAMES_COLOR }}
        numberOfLines={1}
      />
    </Box>
  );
}
