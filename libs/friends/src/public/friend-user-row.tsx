import { Handles } from '@libs/test-ids';
import { Box, Clickable, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import type { FriendProfile } from '../shared/friendship/friends-types';
import { FriendProfileAvatar } from './friend-profile-avatar';

export type FriendUserRowProps = {
  readonly profile: FriendProfile;
  readonly onPress?: (() => void) | undefined;
  readonly trailing?: JSX.Element;
  /** When true, sets the friends-list DST handle from `profile.username`. */
  readonly friendsListHandle?: boolean;
};

function usernameLabel(profile: FriendProfile): string {
  if (profile.username.length > 0) return `@${profile.username}`;
  return profile.userId.slice(0, 8);
}

export function FriendUserRow(props: FriendUserRowProps): JSX.Element {
  const title = usernameLabel(props.profile);
  const rowTestID =
    props.friendsListHandle && props.profile.username.length > 0
      ? Handles.friendsListRow(props.profile.username)
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
      <FriendProfileAvatar profile={props.profile} size={44} />
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <Text variant="bodyBold" label={title} numberOfLines={1} />
      </Box>
      {props.trailing}
    </Box>
  );

  return (
    <Show
      when={props.onPress !== undefined}
      fallback={
        <Show when={rowTestID} keyed fallback={body}>
          {(testID) => <Box dataSet={{ testid: testID }}>{body}</Box>}
        </Show>
      }
    >
      <Clickable
        onClick={() => props.onPress?.()}
        {...(rowTestID !== undefined ? { dataSet: { testid: rowTestID } } : {})}
      >
        {body}
      </Clickable>
    </Show>
  );
}
