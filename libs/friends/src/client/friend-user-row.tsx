import { Box, Pressable, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { FriendProfile } from '../shared/friends-types';
import { FriendProfileAvatar } from './friend-profile-avatar';

export type FriendUserRowProps = {
  readonly profile: FriendProfile;
  readonly onPress?: (() => void) | undefined;
  readonly trailing?: ReactNode;
};

function usernameLabel(profile: FriendProfile): string {
  if (profile.username.length > 0) return `@${profile.username}`;
  return profile.userId.slice(0, 8);
}

export function FriendUserRow({
  profile,
  onPress,
  trailing,
}: FriendUserRowProps): ReactNode {
  const title = usernameLabel(profile);

  const body = (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
      }}
    >
      <FriendProfileAvatar profile={profile} size={44} />
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <Text variant="bodyBold" label={title} numberOfLines={1} />
      </Box>
      {trailing}
    </Box>
  );

  if (onPress === undefined) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}
