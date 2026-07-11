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
        {profile.displayName.length > 0 ? (
          <Text
            variant="title"
            sx={{ textAlign: 'center' }}
            label={profile.displayName}
            numberOfLines={2}
          />
        ) : null}
        <Text
          variant="body"
          sx={{ color: 'textSecondary', textAlign: 'center' }}
          label={handle}
          numberOfLines={1}
        />
      </Box>
      {trailing}
    </Box>
  );
}
