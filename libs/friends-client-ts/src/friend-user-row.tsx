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
  rangesOfMatch,
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
  /**
   * A status under the name, such as a request that is out: it reads as a
   * fact about the person, and leaves the trailing edge to the one control.
   */
  readonly subtitle?: JSX.Element;
  /**
   * A typed search: the part of the name it matched is emphasised, so
   * the eye lands where the search did.
   */
  readonly highlight?: string | undefined;
  /**
   * When true, sets the friends-list DST handle from the name the row shows
   * (a stand-in name when the username is no longer allowed).
   */
  readonly friendsListHandle?: boolean;
  /** DST handle for the pressable identity, when not a friends-list row. */
  readonly pressTestID?: string | undefined;
  /** The face's size. Default 44; a list of bare names uses a smaller one. */
  readonly avatarSize?: number | undefined;
};

const AVATAR_SIZE = 44;
const DISCLOSURE_SIZE = 20;

/**
 * The chevron at a row's end that says the row opens the person: a row's
 * trailing edge when it has no control of its own, so a row never offers a
 * button and a chevron side by side.
 */
export function FriendRowDisclosure(): JSX.Element {
  return <ChevronRightIcon size={DISCLOSURE_SIZE} color="icon" />;
}

function profileLabel(
  moderation: AppModeration,
  profile: FriendProfile
): string {
  const label = usernameLabel(moderation, profile.username, profile.userId);
  return label.length > 0 ? label : profile.userId.slice(0, 8);
}

/** The name, with where a typed search matched emphasised. */
function FriendUserRowName(props: {
  readonly label: string;
  readonly highlight: string | undefined;
}): JSX.Element {
  const ranges = createMemo(() =>
    rangesOfMatch(props.label, props.highlight ?? '')
  );
  return (
    <Show
      when={ranges().length > 0}
      fallback={
        <P variant="body" lines={1}>
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
  readonly highlight?: string | undefined;
  readonly subtitle?: JSX.Element;
  readonly avatarSize?: number | undefined;
}): JSX.Element {
  const moderation = useModeration();
  const label = createMemo(() => profileLabel(moderation(), props.profile));
  return (
    <>
      <FriendProfileAvatar
        profile={props.profile}
        name={label()}
        size={props.avatarSize ?? AVATAR_SIZE}
      />
      <StackVertical grow shrink gap="xs">
        <FriendUserRowName label={label()} highlight={props.highlight} />
        <Show when={props.subtitle !== undefined}>{props.subtitle}</Show>
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
          <FriendUserRowIdentity
            profile={props.profile}
            highlight={props.highlight}
            subtitle={props.subtitle}
            avatarSize={props.avatarSize}
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
              highlight={props.highlight}
              subtitle={props.subtitle}
              avatarSize={props.avatarSize}
            />
          </Pressable>
          {trailing()}
        </StackHorizontal>
      )}
    </Show>
  );
}
