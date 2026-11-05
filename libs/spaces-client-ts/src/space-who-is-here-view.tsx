/**
 * Who is in the space, said under the games list's title while a game is
 * chosen: one line ("5 here · avery hosts") and Invite friends beside it.
 * On a phone the header folds the people into a counted members button, so
 * the line shows their whole faces too; a desktop header already shows
 * those faces, so the line never repeats them.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from 'solid-js';
import { For, Match, Show, Switch } from 'solid-js';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar } from './space-person-view';
import type { SpacePresenceFace } from './space-presence-strip-view';

/** Each face's slot: big enough to tell people apart at a glance. */
const SLOT_SIZE = 32;
/** The canvas ring around each face. */
const RING_WIDTH = 2;
/** The face sits inside its ring, so the ring never crops it. */
const FACE_SIZE = SLOT_SIZE - RING_WIDTH * 2;
/**
 * Neighbours share only their rings: every face shows whole, never a
 * sliver behind the next one.
 */
const OVERLAP = RING_WIDTH;
/** Faces before the overflow pill ("+2"). */
const MAX_FACES = 4;

export type SpaceWhoIsHereViewProps = {
  /** One face per person here, in roster order. */
  readonly faces: readonly SpacePresenceFace[];
  /** The host, once their profile is known. */
  readonly host: SpacePerson | null;
  /** The person looking hosts this space. */
  readonly hostIsYou: boolean;
  /** Opens the space's Share sheet (its link and Add people). */
  readonly onInvite?: (() => void) | undefined;
};

/** Who hosts, in the caption's words; nothing while the host is unknown. */
function HostWords(props: {
  readonly host: SpacePerson | null;
  readonly hostIsYou: boolean;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.hostIsYou}>
        <Trans>you host</Trans>
      </Match>
      <Match when={props.host} keyed>
        {(host) => {
          const name = host.name;
          return <Trans>{name} hosts</Trans>;
        }}
      </Match>
    </Switch>
  );
}

/** How many are here and who hosts, as one line in the secondary ink. */
function RoomCaption(props: SpaceWhoIsHereViewProps): JSX.Element {
  const count = (): number => props.faces.length;
  const named = (): boolean => props.hostIsYou || props.host !== null;
  return (
    <P variant="body" tone="secondary" lines={1}>
      <Show
        when={count() > 1 || !props.hostIsYou}
        fallback={<Trans>Just you here</Trans>}
      >
        <Plural value={count()} one="# here" other="# here" />
        <Show when={named()}>
          {' · '}
          <HostWords host={props.host} hostIsYou={props.hostIsYou} />
        </Show>
      </Show>
    </P>
  );
}

/** The labelled way to bring someone in: the space's Share sheet. */
function InviteFriendsButton(props: {
  readonly onInvite: () => void;
}): JSX.Element {
  return (
    <Button
      title={<Trans>Invite friends</Trans>}
      icon={UserPlusIcon}
      intent="neutral"
      variant="outline"
      size="sm"
      onClick={() => props.onInvite()}
      dataSet={{ testid: Handles.spaceInviteFriends }}
    />
  );
}

/** The whole faces of everyone here, a few, then "+N". */
function HereFaces(props: {
  readonly faces: readonly SpacePresenceFace[];
}): JSX.Element {
  return (
    <AvatarGroup
      size={SLOT_SIZE}
      overlap={OVERLAP}
      ringBorderWidth={RING_WIDTH}
      maxVisible={MAX_FACES}
    >
      <For each={props.faces}>
        {(face) => <SpacePersonAvatar person={face.person} size={FACE_SIZE} />}
      </For>
    </AvatarGroup>
  );
}

/**
 * Who is here and who hosts, then Invite friends. A desktop header already
 * shows the faces, so there the line is the words with Invite friends right
 * beside them; a phone's header shows only a count, so its line leads with
 * the faces and Invite friends sits under them. Nothing before anyone is
 * connected.
 */
export function SpaceWhoIsHereView(
  props: SpaceWhoIsHereViewProps
): JSX.Element {
  const mode = useLayoutMode();
  const invite = (): JSX.Element => (
    <Show when={props.onInvite}>
      {(onInvite) => <InviteFriendsButton onInvite={onInvite()} />}
    </Show>
  );
  return (
    <Show when={props.faces.length > 0}>
      <Show
        when={mode() === 'compact'}
        fallback={
          <StackHorizontal align="center" gap="md">
            <RoomCaption {...props} />
            {invite()}
          </StackHorizontal>
        }
      >
        <StackVertical gap="sm" align="start">
          <StackHorizontal align="center" gap="sm">
            <HereFaces faces={props.faces} />
            <RoomCaption {...props} />
          </StackHorizontal>
          {invite()}
        </StackVertical>
      </Show>
    </Show>
  );
}
