import { UserDisplayName } from '@gamezilla/client/profile/user-display-name';
import { UserProfileAvatar } from '@gamezilla/client/profile/user-profile-avatar';
import { MemberPresenceBadgesRow } from '@gamezilla/client/spaces/member-presence-badges-row';
import { MemberPresenceDot } from '@gamezilla/client/spaces/member-presence-dot';
import { MemberThisTabHighlight } from '@gamezilla/client/spaces/member-this-tab-highlight';
import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type SpaceMemberTileRailProps = {
  spaceId: string;
  profileId: string;
};

const RAIL_RADIUS = 10;
const AVATAR_SIZE = 40;
const ONLINE_DOT_SIZE = 8;

/** Rail-style member tile keyed by `(spaceId, profileId)` — pure layout. */
export function SpaceMemberTileRail({
  spaceId,
  profileId,
}: SpaceMemberTileRailProps): ReactNode {
  return (
    <MemberThisTabHighlight
      spaceId={spaceId}
      profileId={profileId}
      borderRadius={RAIL_RADIUS}
    >
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 2,
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
        <Box sx={{ flex: 1, minWidth: 0, gap: 1 }}>
          <UserDisplayName
            profileId={profileId}
            variant="body"
            numberOfLines={1}
          />
          <MemberPresenceBadgesRow spaceId={spaceId} profileId={profileId} />
        </Box>
      </Box>
    </MemberThisTabHighlight>
  );
}
