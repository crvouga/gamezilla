import { Handles } from '@libs/test-ids';
import { Box, Pressable, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { FriendProfile } from '../shared/friendship/friends-types';
import { FriendProfileAvatar } from './friend-profile-avatar';

export type FriendUserRowProps = {
  readonly profile: FriendProfile;
  readonly onPress?: (() => void) | undefined;
  readonly trailing?: ReactNode;
  /** When true, sets the friends-list DST handle from `profile.username`. */
  readonly friendsListHandle?: boolean;
};

function usernameLabel(profile: FriendProfile): string {
  if (profile.username.length > 0) return `@${profile.username}`;
  return profile.userId.slice(0, 8);
}

export function FriendUserRow({
  profile,
  onPress,
  trailing,
  friendsListHandle = false,
}: FriendUserRowProps): ReactNode {
  const title = usernameLabel(profile);
  const rowTestID =
    friendsListHandle && profile.username.length > 0
      ? Handles.friendsListRow(profile.username)
      : undefined;

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

  if (onPress === undefined) {
    if (rowTestID === undefined) return body;
    return <Box testID={rowTestID}>{body}</Box>;
  }
  return (
    <Pressable
      onPress={onPress}
      {...(rowTestID !== undefined ? { testID: rowTestID } : {})}
    >
      {body}
    </Pressable>
  );
}
