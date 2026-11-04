import type { FriendProfile } from '@libs/friends-shared-ts/friends-types';
import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import {
  usernameLabel,
  usernameText,
} from '@libs/moderation-shared-ts/display';
import type { AppModeration } from '@libs/moderation-shared-ts/policy';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import {
  HighlightedText,
  rangesAfterMatch,
} from '@pkgs/ui-root-client-ts/highlighted-text';
import { ChevronRightIcon } from '@pkgs/ui-root-client-ts/icons';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';

export type FriendUserRowProps = {
  readonly profile: FriendProfile;
  readonly onPress?: (() => void) | undefined;
  readonly trailing?: JSX.Element;
  /** A line under the name, such as how long you have been friends. */
  readonly caption?: JSX.Element;
  /**
   * A typed search: the part of the name after it is emphasised, so
   * similar names ("@jordan", "@jordan_plays") read apart at a glance.
   */
  readonly highlight?: string | undefined;
  /**
   * When true, sets the friends-list DST handle from the name the row shows
   * (a stand-in name when the username is no longer allowed).
   */
  readonly friendsListHandle?: boolean;
  /** DST handle for the pressable identity, when not a friends-list row. */
  readonly pressTestID?: string | undefined;
  /**
   * Ends the pressable identity in a chevron: the row opens the person and
   * has no trailing action of its own to say so.
   */
  readonly disclosure?: boolean | undefined;
};

function profileLabel(
  moderation: AppModeration,
  profile: FriendProfile
): string {
  const label = usernameLabel(moderation, profile.username, profile.userId);
  return label.length > 0 ? label : profile.userId.slice(0, 8);
}

/** The name, with what follows a typed search emphasised when there is one. */
function FriendUserRowName(props: {
  readonly label: string;
  readonly highlight: string | undefined;
}): JSX.Element {
  const ranges = createMemo(() =>
    rangesAfterMatch(props.label, props.highlight ?? '')
  );
  return (
    <Show
      when={ranges().length > 0}
      fallback={
        <P variant="bodyBold" lines={1}>
          {props.label}
        </P>
      }
    >
      <HighlightedText
        text={props.label}
        ranges={ranges()}
        variant="body"
        boldVariant="bodyBold"
        numberOfLines={1}
      />
    </Show>
  );
}

function FriendUserRowIdentity(props: {
  readonly profile: FriendProfile;
  readonly caption?: JSX.Element;
  readonly highlight?: string | undefined;
  readonly disclosure?: boolean | undefined;
}): JSX.Element {
  const moderation = useModeration();
  const label = createMemo(() => profileLabel(moderation(), props.profile));
  return (
    <>
      <FriendProfileAvatar profile={props.profile} name={label()} size={44} />
      <StackVertical grow>
        <FriendUserRowName label={label()} highlight={props.highlight} />
        <Show when={props.caption !== undefined}>
          <P variant="caption" lines={1}>
            {props.caption}
          </P>
        </Show>
      </StackVertical>
      <Show when={props.disclosure === true}>
        <ChevronRightIcon size={20} color="icon" />
      </Show>
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
          <FriendUserRowIdentity
            profile={props.profile}
            caption={props.caption}
            highlight={props.highlight}
          />
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
            <FriendUserRowIdentity
              profile={props.profile}
              caption={props.caption}
              highlight={props.highlight}
              disclosure={props.disclosure}
            />
          </Pressable>
          {trailing()}
        </StackHorizontal>
      )}
    </Show>
  );
}
