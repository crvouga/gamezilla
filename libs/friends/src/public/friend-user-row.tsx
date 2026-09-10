import { Handles } from '@libs/test-ids';
import { dataAttrs } from '@pkgs/ui';
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
    <div class="box flex-row items-center gap-2 py-2">
      <FriendProfileAvatar profile={props.profile} size={44} />
      <div class="box flex-1 min-w-[0] gap-0.5">
        <p class="text textBodyBold line-clamp-1">{title}</p>
      </div>
      {props.trailing}
    </div>
  );

  return (
    <Show
      when={props.onPress !== undefined}
      fallback={
        <Show when={rowTestID} keyed fallback={body}>
          {(testID) => (
            <div class="box" data-testid={testID}>
              {body}
            </div>
          )}
        </Show>
      }
    >
      <button
        class="clickable clickableTint"
        {...(rowTestID !== undefined ? dataAttrs({ testid: rowTestID }) : {})}
        type="button"
        onClick={() => props.onPress?.()}
      >
        {body}
      </button>
    </Show>
  );
}
