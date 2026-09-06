import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { Box, Pressable } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import type { UserSearchResult } from './user-search-types';

export type UserSearchResultRowProps = {
  readonly user: UserSearchResult;
  readonly onPress?: (() => void) | undefined;
  readonly trailing?: ReactNode;
};

/** Avatar + username row for pickers (no friend-action chrome). */
export function UserSearchResultRow({
  user,
  onPress,
  trailing,
}: UserSearchResultRowProps): ReactNode {
  const body = (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
      }}
    >
      <UserProfileAvatar profileId={user.userId} size={44} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <UserUsername
          profileId={user.userId}
          variant="bodyBold"
          numberOfLines={1}
        />
      </Box>
      {trailing}
    </Box>
  );

  if (onPress === undefined) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}
