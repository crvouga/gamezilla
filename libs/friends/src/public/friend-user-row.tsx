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

function FriendUserRowIdentity(props: {
  readonly profile: FriendProfile;
}): JSX.Element {
  return (
    <>
      <FriendProfileAvatar profile={props.profile} size={44} />
      <div class="box flex-1 min-w-[0] gap-0.5">
        <p class="text textBodyBold line-clamp-1">
          {usernameLabel(props.profile)}
        </p>
      </div>
    </>
  );
}

export function FriendUserRow(props: FriendUserRowProps): JSX.Element {
  const rowTestID =
    props.friendsListHandle && props.profile.username.length > 0
      ? Handles.friendsListRow(props.profile.username)
      : undefined;

  const trailing = () => (
    <Show when={props.trailing !== undefined}>
      <div class="box shrink-0">{props.trailing}</div>
    </Show>
  );

  return (
    <Show
      when={props.onPress !== undefined}
      fallback={
        <div
          class="box flex-row items-center gap-2 py-2 min-w-[0] self-stretch"
          {...(rowTestID !== undefined ? dataAttrs({ testid: rowTestID }) : {})}
        >
          <FriendUserRowIdentity profile={props.profile} />
          {trailing()}
        </div>
      }
    >
      <div
        class="box flex-row items-center gap-2 py-2 min-w-[0] self-stretch"
        {...(rowTestID !== undefined ? dataAttrs({ testid: rowTestID }) : {})}
      >
        <button
          class="clickable clickableTint box flex-1 flex-row items-center gap-2 min-w-[0]"
          type="button"
          onClick={() => props.onPress?.()}
        >
          <FriendUserRowIdentity profile={props.profile} />
        </button>
        {trailing()}
      </div>
    </Show>
  );
}
