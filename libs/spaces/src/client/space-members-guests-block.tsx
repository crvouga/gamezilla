import { SpaceGuestMembershipTileRail } from './space-guest-membership-tile-rail';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { Box, Text } from '@gamezilla/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceMembersGuestsBlockProps = {
  spaceId: string;
};

/** Section showing each guest's tile, or a "no guests yet" placeholder. */
export function SpaceMembersGuestsBlock({
  spaceId,
}: SpaceMembersGuestsBlockProps): ReactNode {
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', px: 2 }}
        label={<Trans>Guests</Trans>}
      />
      <Box sx={{ gap: 0 }}>
        {membershipIds.length === 0 ? (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', px: 2 }}
            label={<Trans>No guests yet</Trans>}
          />
        ) : (
          membershipIds.map((mid) => (
            <SpaceGuestMembershipTileRail
              key={mid}
              spaceId={spaceId}
              membershipId={mid}
            />
          ))
        )}
      </Box>
    </Box>
  );
}
