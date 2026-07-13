import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { FriendProfile } from '../shared/friends-types';
import { FriendProfileAvatar } from './friend-profile-avatar';

export type FriendProfileHeaderProps = {
  readonly profile: FriendProfile;
  readonly avatarSize?: number;
  readonly trailing?: ReactNode;
};

export function FriendProfileHeader({
  profile,
  avatarSize = 96,
  trailing,
}: FriendProfileHeaderProps): ReactNode {
  const handle =
    profile.username.length > 0
      ? `@${profile.username}`
      : profile.userId.slice(0, 8);

  return (
    <Box sx={{ alignItems: 'center', gap: 2, alignSelf: 'stretch' }}>
      <FriendProfileAvatar profile={profile} size={avatarSize} />
      <Box sx={{ alignItems: 'center', gap: 1, alignSelf: 'stretch' }}>
        <Text
          variant="title"
          sx={{ textAlign: 'center' }}
          label={handle}
          numberOfLines={1}
        />
      </Box>
      {trailing}
    </Box>
  );
}
