import { Box } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { SpaceGuestAvatarGroup } from './space-guest-avatar-group';
import { SpaceGuestCountText } from './space-guest-count-text';
import { SpaceGuestNamesLine } from './space-guest-names-line';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestSectionProps = {
  spaceId: string;
};

const AVATAR_SIZE = 24;
const AVATAR_GROUP_RING = 'surface' as const;
const AVATAR_MAX_VISIBLE = 6;

/**
 * Count line, avatar stack, and joined names for space-card guests.
 * Renders nothing when the space has no guests — no placeholder, no spacer.
 */
export function SpaceGuestSection({
  spaceId,
}: SpaceGuestSectionProps): ReactNode {
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  if (membershipIds.length === 0) {
    return null;
  }
  return (
    <Box sx={{ mt: 3, gap: 1.5 }}>
      <SpaceGuestCountText spaceId={spaceId} variant="caption" />
      <SpaceGuestAvatarGroup
        spaceId={spaceId}
        size={AVATAR_SIZE}
        maxVisible={AVATAR_MAX_VISIBLE}
        ringColor={AVATAR_GROUP_RING}
      />
      <SpaceGuestNamesLine
        spaceId={spaceId}
        variant="caption"
        numberOfLines={1}
      />
    </Box>
  );
}
