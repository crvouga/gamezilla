import { UserDisplayName } from '@gamezilla/client/profile/user-display-name';
import { UserProfileAvatar } from '@gamezilla/client/profile/user-profile-avatar';
import { MemberPresenceBadgesRow } from '@gamezilla/client/spaces/member-presence-badges-row';
import { MemberPresenceDot } from '@gamezilla/client/spaces/member-presence-dot';
import { MemberThisTabHighlight } from '@gamezilla/client/spaces/member-this-tab-highlight';
import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type SpaceMemberTileChipProps = {
  spaceId: string;
  profileId: string;
};

const CHIP_RADIUS = 12;
const AVATAR_SIZE = 36;
const ONLINE_DOT_SIZE = 8;

/** Chip-style member tile keyed by `(spaceId, profileId)` — pure layout. */
export function SpaceMemberTileChip({
  spaceId,
  profileId,
}: SpaceMemberTileChipProps): ReactNode {
  return (
    <MemberThisTabHighlight
      spaceId={spaceId}
      profileId={profileId}
      borderRadius={CHIP_RADIUS}
    >
      <Box
        sx={{
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          minWidth: 56,
        }}
      >
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <MemberPresenceDot
            spaceId={spaceId}
            profileId={profileId}
            size={ONLINE_DOT_SIZE}
          />
          <UserProfileAvatar profileId={profileId} size={AVATAR_SIZE} />
        </Box>
        <UserDisplayName
          profileId={profileId}
          variant="caption"
          numberOfLines={1}
        />
        <MemberPresenceBadgesRow spaceId={spaceId} profileId={profileId} />
      </Box>
    </MemberThisTabHighlight>
  );
}
