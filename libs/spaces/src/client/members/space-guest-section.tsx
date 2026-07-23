import { NoGuestsText } from './no-guests-text';
import { SpaceGuestAvatarGroup } from './space-guest-avatar-group';
import { SpaceGuestCountText } from './space-guest-count-text';
import { SpaceGuestNamesLine } from './space-guest-names-line';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type SpaceGuestSectionProps = {
  spaceId: string;
};

const AVATAR_SIZE = 24;
const AVATAR_GROUP_RING = 'surface' as const;
const AVATAR_MAX_VISIBLE = 6;

/**
 * Pure layout: count line, avatar stack, and joined name list for the guests
 * of a space card. Empty spaces show a single muted placeholder.
 */
export function SpaceGuestSection({
  spaceId,
}: SpaceGuestSectionProps): ReactNode {
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  if (membershipIds.length === 0) {
    return (
      <Box sx={{ mt: 3 }}>
        <NoGuestsText variant="caption" sx={{ color: 'textSecondary' }} />
      </Box>
    );
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
