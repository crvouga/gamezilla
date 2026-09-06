import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { Box, Pressable } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import type { UserSearchResult } from './user-search-types';

export type UserSearchResultRowProps = {
  readonly user: UserSearchResult;
  readonly onPress?: (() => void) | undefined;
  readonly trailing?: JSX.Element;
};

/** Avatar + username row for pickers (no friend-action chrome). */
export function UserSearchResultRow(
  props: UserSearchResultRowProps
): JSX.Element {
  const body = () => (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
      }}
    >
      <UserProfileAvatar profileId={props.user.userId} size={44} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <UserUsername
          profileId={props.user.userId}
          variant="bodyBold"
          numberOfLines={1}
        />
      </Box>
      {props.trailing}
    </Box>
  );

  return (
    <Show when={props.onPress} fallback={body()}>
      {(onPress) => <Pressable onPress={() => onPress()()}>{body()}</Pressable>}
    </Show>
  );
}
