import type { FriendProfile } from '@libs/friends-shared/friends-types';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameLabel, usernameText } from '@libs/moderation-shared/display';
import type { AppModeration } from '@libs/moderation-shared/policy';
import { Handles } from '@libs/test-ids-shared/handles';
import { Pressable } from '@pkgs/ui-root-client/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
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
      <StackVertical grow>
        <P variant="bodyBold" lines={1}>
          {profileLabel(moderation(), props.profile)}
        </P>
      </StackVertical>
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

  const trailing = () => (
    <Show when={props.trailing !== undefined}>
      <StackVertical>{props.trailing}</StackVertical>
    </Show>
  );

  return (
    <Show
      when={props.onPress}
      fallback={
        <StackHorizontal
          align="center"
          gap="sm"
          paddingY="sm"
          self="stretch"
          testId={rowTestID()}
        >
          <FriendUserRowIdentity profile={props.profile} />
          {trailing()}
        </StackHorizontal>
      }
    >
      {(onPress) => (
        <StackHorizontal align="center" gap="sm" paddingY="sm" self="stretch">
          {/* The handle marks what a person presses, so a driver's tap lands. */}
          <Pressable
            onPress={() => onPress()()}
            direction="horizontal"
            align="center"
            gap="sm"
            grow
            radius="control"
            testId={rowTestID()}
          >
            <FriendUserRowIdentity profile={props.profile} />
          </Pressable>
          {trailing()}
        </StackHorizontal>
      )}
    </Show>
  );
}
