import { UserUsername } from '@libs/profile/client/user-username';
import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import { MemberPresenceBadgesRow } from './member-presence-badges-row';
import { MemberPresenceDot } from './member-presence-dot';
import { MemberThisTabHighlight } from './member-this-tab-highlight';
import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type SpaceMemberTileRailProps = {
  spaceId: string;
  /** Install seat id (presence / You / Host badges). */
  deviceId: string;
  /** Profile id for avatar/username. */
  profileId: string;
  deviceLabel?: string | null;
};

const RAIL_RADIUS = 10;
const AVATAR_SIZE = 40;
const ONLINE_DOT_SIZE = 8;

/** Rail-style member tile keyed by device seat + profile display. */
export function SpaceMemberTileRail({
  spaceId,
  deviceId,
  profileId,
  deviceLabel,
}: SpaceMemberTileRailProps): ReactNode {
  return (
    <MemberThisTabHighlight
      spaceId={spaceId}
      profileId={deviceId}
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
            profileId={deviceId}
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
          {deviceLabel !== null &&
          deviceLabel !== undefined &&
          deviceLabel.length > 0 ? (
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              numberOfLines={1}
              label={deviceLabel}
            />
          ) : null}
          <MemberPresenceBadgesRow spaceId={spaceId} profileId={deviceId} />
        </Box>
      </Box>
    </MemberThisTabHighlight>
  );
}
