/**
 * Who is in the space, said under the games list's title while a game is
 * chosen: the whole faces of everyone here and one line ("5 here · avery
 * hosts"). The space's header folds the same people into its members
 * button, so without this line the choice is made blind to the room.
 */

import { Plural, Trans } from '@lingui/solid/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
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

/** The faces of everyone here and who hosts; nothing before anyone is. */
export function SpaceWhoIsHereView(
  props: SpaceWhoIsHereViewProps
): JSX.Element {
  return (
    <Show when={props.faces.length > 0}>
      <StackHorizontal align="center" gap="sm">
        <AvatarGroup
          size={SLOT_SIZE}
          overlap={OVERLAP}
          ringBorderWidth={RING_WIDTH}
          maxVisible={MAX_FACES}
        >
          <For each={props.faces}>
            {(face) => (
              <SpacePersonAvatar person={face.person} size={FACE_SIZE} />
            )}
          </For>
        </AvatarGroup>
        <RoomCaption {...props} />
      </StackHorizontal>
    </Show>
  );
}
