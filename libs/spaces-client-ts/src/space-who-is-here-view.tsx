/**
 * Who is in the space while a game is chosen. On a phone, under the games
 * list's title, one line of their faces and words ("5 here · avery
 * hosts") with Invite friends under it: the header folds the people into a
 * counted members button. On a desktop, under the games, a "Who's here"
 * section: each person here by face and name, the host marked, and Invite
 * friends at its head, so the page shows who the game is for, not only
 * the header's small faces.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural, Trans } from '@lingui/solid/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
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

/** A desktop person's face: a row's size, larger than the header's. */
const PERSON_SIZE = 40;

/** People to a row in the desktop section: the games' four tiles above. */
const PEOPLE_COLUMNS = 4;

/** One person here, by face and name, the host marked. */
function HerePerson(props: {
  readonly person: SpacePerson;
  readonly hosts: boolean;
}): JSX.Element {
  return (
    <StackHorizontal align="center" gap="sm" role="listitem">
      <SpacePersonAvatar person={props.person} size={PERSON_SIZE} />
      <P variant="body" lines={1}>
        {props.person.name}
      </P>
      <Show when={props.hosts}>
        {/* Its own box, so the tag centres on the name's line. */}
        <StackVertical>
          <HostBadge />
        </StackVertical>
      </Show>
    </StackHorizontal>
  );
}

/**
 * A desktop's "Who's here": its heading with how many and who hosts, and
 * Invite friends at its end; then everyone here whose profile is known, by
 * face and name, in one panel, four to a row like the games above.
 */
function WhoIsHereSection(props: SpaceWhoIsHereViewProps): JSX.Element {
  const people = (): readonly SpacePerson[] =>
    props.faces.flatMap((face) => (face.person === null ? [] : [face.person]));
  const hostId = (): string | undefined => props.host?.id;
  return (
    <StackVertical gap="sm" testId="space-who-is-here">
      <StackHorizontal align="center" gap="md">
        <StackHorizontal align="center" gap="sm" grow>
          <H2 size="subtitle">
            <Trans>Who's here</Trans>
          </H2>
          <RoomCaption {...props} />
        </StackHorizontal>
        <Show when={props.onInvite}>
          {(onInvite) => <InviteFriendsButton onInvite={onInvite()} />}
        </Show>
      </StackHorizontal>
      <Show when={people().length > 0}>
        <Surface tone="surface" radius="card" border padding="lg">
          <Grid columns={PEOPLE_COLUMNS} gap="md" role="list">
            <For each={people()}>
              {(person) => (
                <HerePerson person={person} hosts={person.id === hostId()} />
              )}
            </For>
          </Grid>
        </Surface>
      </Show>
    </StackVertical>
  );
}

/**
 * Who is here and who hosts, then Invite friends. On a desktop, the "Who's
 * here" section (under the games, see `SpaceGamesScreenView`); a phone's
 * header shows only a count, so its line leads with the faces and Invite
 * friends sits under them. Nothing before anyone is connected.
 */
export function SpaceWhoIsHereView(
  props: SpaceWhoIsHereViewProps
): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show when={props.faces.length > 0}>
      <Show
        when={mode() === 'compact'}
        fallback={<WhoIsHereSection {...props} />}
      >
        <StackVertical gap="sm" align="start">
          <StackHorizontal align="center" gap="sm">
            <HereFaces faces={props.faces} />
            <RoomCaption {...props} />
          </StackHorizontal>
          <Show when={props.onInvite}>
            {(onInvite) => <InviteFriendsButton onInvite={onInvite()} />}
          </Show>
        </StackVertical>
      </Show>
    </Show>
  );
}
