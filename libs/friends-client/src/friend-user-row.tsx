import type { FriendProfile } from '@libs/friends-shared/friends-types';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameLabel, usernameText } from '@libs/moderation-shared/display';
import type { AppModeration } from '@libs/moderation-shared/policy';
import { Handles } from '@libs/test-ids-shared/handles';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';

export type FriendUserRowProps = {
  readonly profile: FriendProfile;
  readonly onPress?: (() => void) | undefined;
  readonly trailing?: JSX.Element;
  /**
   * When true, sets the friends-list DST handle from the name the row shows
   * (a stand-in name when the username is no longer allowed).
   */
  readonly friendsListHandle?: boolean;
  /** DST handle for the pressable identity, when not a friends-list row. */
  readonly pressTestID?: string | undefined;
};

function profileLabel(
  moderation: AppModeration,
  profile: FriendProfile
): string {
  const label = usernameLabel(moderation, profile.username, profile.userId);
  return label.length > 0 ? label : profile.userId.slice(0, 8);
}

function FriendUserRowIdentity(props: {
  readonly profile: FriendProfile;
}): JSX.Element {
  const moderation = useModeration();
  return (
    <>
      <FriendProfileAvatar profile={props.profile} size={44} />
      <div class="box flex-1 min-w-0 gap-0.5">
        <p class="text textBodyBold line-clamp-1">
          {profileLabel(moderation(), props.profile)}
        </p>
      </div>
    </>
  );
}

export function FriendUserRow(props: FriendUserRowProps): JSX.Element {
  const moderation = useModeration();
  const shownName = createMemo(() =>
    usernameText(moderation(), props.profile.username, props.profile.userId)
  );
  const rowTestID = createMemo(() =>
    props.friendsListHandle === true && shownName().length > 0
      ? Handles.friendsListRow(shownName())
      : props.pressTestID
  );

  const rowAttrs = () => {
    const id = rowTestID();
    return id !== undefined ? dataAttrs({ testid: id }) : {};
  };

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
          class="box flex-row items-center gap-2 py-2 min-w-0 self-stretch"
          {...rowAttrs()}
        >
          <FriendUserRowIdentity profile={props.profile} />
          {trailing()}
        </div>
      }
    >
      <div class="box flex-row items-center gap-2 py-2 min-w-0 self-stretch">
        {/* The handle marks what a person presses, so a driver's tap lands. */}
        <button
          class="clickable clickableTint box flex-1 flex-row items-center gap-2 min-w-0"
          type="button"
          onClick={() => props.onPress?.()}
          {...rowAttrs()}
        >
          <FriendUserRowIdentity profile={props.profile} />
        </button>
        {trailing()}
      </div>
    </Show>
  );
}
