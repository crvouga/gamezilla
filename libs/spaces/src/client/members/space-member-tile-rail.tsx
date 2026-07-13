import { UserUsername } from '@libs/profile/client/user-username';
import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { MemberPresenceBadgesRow } from './member-presence-badges-row';
import { MemberPresenceDot } from './member-presence-dot';
import { MemberThisTabHighlight } from './member-this-tab-highlight';
import { Box } from '@pkgs/ui';
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
          <UserUsername
            profileId={profileId}
            withAt={false}
            variant="body"
            numberOfLines={1}
          />
          <MemberPresenceBadgesRow spaceId={spaceId} profileId={profileId} />
        </Box>
      </Box>
    </MemberThisTabHighlight>
  );
}
