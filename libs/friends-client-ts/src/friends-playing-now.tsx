import type { FriendProfile } from '@libs/friends-shared-ts/friends-types';
import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameLabel } from '@libs/moderation-shared-ts/display';
import {
  type FriendLiveSpaceAction,
  FriendLiveSpaceJoinView,
  FriendLiveSpaceStatusView,
} from '@libs/spaces-client-ts/friend-live-space';
import { openSpaceDetail } from '@libs/spaces-client-ts/space-routes';
import { useLiveSpaceTitles } from '@libs/spaces-client-ts/use-live-space-titles';
import { useLiveSpacesByPerson } from '@libs/spaces-client-ts/use-live-spaces-by-person';
import { useOpenSpaceSessionIds } from '@libs/spaces-client-ts/use-open-space-session-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MonogramTile } from '@pkgs/ui-root-client-ts/monogram-tile';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';

/** Faces in a room's caption line, beside its words. */
const FACE_SIZE = 20;
const FACES_SHOWN = 3;
/** A profile lists a few rooms; the friends list has everyone in them. */
const ROOMS_SHOWN = 3;

/** One friend in a room, and whether they run it. */
export type RoomFriend = {
  readonly friend: FriendProfile;
  readonly hosting: boolean;
};

/** A live space friends are in: its name, who of them is there, and Join. */
export type PlayingRoom = {
  readonly spaceId: string;
  /** The room's own name, or null when it goes by its host's name. */
  readonly title: string | null;
  /** Friends in it, the host (when a friend hosts) first. */
  readonly friends: readonly RoomFriend[];
  readonly action: FriendLiveSpaceAction;
  readonly onJoin: () => void;
};

/** The friends' shown names, with the "@" (`withAt`) or as plain words. */
function useNames(
  friends: () => readonly RoomFriend[],
  withAt: boolean
): () => readonly string[] {
  const moderation = useModeration();
  return () =>
    friends().map((entry) =>
      usernameLabel(moderation(), entry.friend.username, entry.friend.userId, {
        withAt,
      })
    );
}

/** The room's name: its own, its host's ("jordan_plays's space"), or "A space". */
export function useRoomTitle(room: () => PlayingRoom): () => string {
  const { t } = useLingui();
  const names = useNames(() => room().friends, false);
  return () => {
    const own = room().title;
    if (own !== null) return own;
    const host = room().friends[0]?.hosting === true ? names()[0] : undefined;
    return host === undefined ? t`A space` : t`${host}'s space`;
  };
}

/**
 * Who of your friends is there, in words short enough for a phone's row
 * (their faces stand beside them): "jordan_plays hosts", or, when no
 * friend hosts, the names of those in it.
 */
function useRoomCaption(room: () => PlayingRoom): () => string {
  const { t } = useLingui();
  const names = useNames(() => room().friends, false);
  return () => {
    const all = names();
    if (room().friends[0]?.hosting !== true) return all.join(', ');
    const host = all[0] ?? '';
    return t`${host} hosts`;
  };
}

/** Who of your friends is in a room: their faces, the host first, then the words. */
function RoomCaption(props: { readonly room: PlayingRoom }): JSX.Element {
  const names = useNames(() => props.room.friends, true);
  const caption = useRoomCaption(() => props.room);
  return (
    <StackHorizontal align="center" gap="xs">
      <AvatarGroup
        size={FACE_SIZE}
        maxVisible={FACES_SHOWN}
        ringColor="surface"
      >
        <For each={props.room.friends}>
          {(entry, index) => (
            <FriendProfileAvatar
              profile={entry.friend}
              name={names()[index()] ?? ''}
              size={FACE_SIZE}
            />
          )}
        </For>
      </AvatarGroup>
      <P variant="caption" lines={1}>
        {caption()}
      </P>
    </StackHorizontal>
  );
}

/**
 * One room: its own tile and name (every room wears the same tile
 * wherever it is shown), who of your friends is there (their faces and
 * who hosts), and one Join.
 */
function PlayingRoomRow(props: { readonly room: PlayingRoom }): JSX.Element {
  const title = useRoomTitle(() => props.room);
  return (
    <MenuRow
      leading={
        <MonogramTile name={title()} seed={props.room.spaceId} size="md" />
      }
      title={title()}
      caption={<RoomCaption room={props.room} />}
      trailing={
        <FriendLiveSpaceJoinView
          action={props.room.action}
          onPress={() => props.room.onJoin()}
        />
      }
    />
  );
}

/**
 * "Playing now" by room, on the person's own profile: each live space
 * friends are in (the first few), by its tile and name, who of them is
 * there, and one Join for the room — so two friends in one room never
 * offer two ways into it. Nothing at all while nobody is playing, so the
 * profile never shows an empty panel.
 */
export function FriendsPlayingNowView(props: {
  readonly rooms: readonly PlayingRoom[];
}): JSX.Element {
  return (
    <Show when={props.rooms.length > 0}>
      <MenuSection title={<Trans>Playing now</Trans>}>
        <For each={props.rooms.slice(0, ROOMS_SHOWN)}>
          {(room) => <PlayingRoomRow room={room} />}
        </For>
      </MenuSection>
    </Show>
  );
}

/**
 * What a friend is doing, under their name in the friends list: the
 * room's tile, then the online dot and the words ("Hosting Friday chess",
 * "In morgan's space"), so the same room reads the same on every row.
 */
export function FriendRoomStatusView(props: {
  readonly room: PlayingRoom;
  readonly hosting: boolean;
}): JSX.Element {
  const title = useRoomTitle(() => props.room);
  return (
    <StackHorizontal align="center" gap="xs">
      <MonogramTile name={title()} seed={props.room.spaceId} size="xs" />
      <FriendLiveSpaceStatusView
        hosting={props.hosting}
        title={props.room.title}
      />
    </StackHorizontal>
  );
}

/** Each friend in a live space, by their id: the room they are in, and whether they host it. */
export function roomsByFriend(
  rooms: readonly PlayingRoom[]
): ReadonlyMap<
  string,
  { readonly room: PlayingRoom; readonly hosting: boolean }
> {
  const byFriend = new Map<
    string,
    { readonly room: PlayingRoom; readonly hosting: boolean }
  >();
  for (const room of rooms) {
    for (const entry of room.friends) {
      byFriend.set(entry.friend.userId, { room, hosting: entry.hosting });
    }
  }
  return byFriend;
}

/** Live friends first (hosts before guests), each group in its given order. */
export function liveFriendsFirst<T extends { readonly userId: string }>(
  friends: readonly T[],
  live: ReadonlyMap<string, { readonly hosting: boolean }>
): T[] {
  const rank = (friend: T): number => {
    const space = live.get(friend.userId);
    if (space === undefined) return 2;
    return space.hosting ? 0 : 1;
  };
  return friends
    .map((friend, index) => ({ friend, index }))
    .sort((a, b) => rank(a.friend) - rank(b.friend) || a.index - b.index)
    .map((entry) => entry.friend);
}

/** The rooms `friends` are in right now, from synced live spaces. */
export function usePlayingRooms(
  friends: Accessor<readonly FriendProfile[]>
): Accessor<readonly PlayingRoom[]> {
  const router = useRouter();
  const live = useLiveSpacesByPerson();
  const titles = useLiveSpaceTitles();
  const open = useOpenSpaceSessionIds();
  return createMemo(() => {
    const rooms = new Map<string, RoomFriend[]>();
    for (const friend of liveFriendsFirst(friends(), live())) {
      const space = live().get(friend.userId);
      if (space === undefined) continue;
      const entries = rooms.get(space.spaceId) ?? [];
      entries.push({ friend, hosting: space.hosting });
      rooms.set(space.spaceId, entries);
    }
    return [...rooms.entries()].map(
      ([spaceId, entries]): PlayingRoom => ({
        spaceId,
        title: titles().get(spaceId) ?? null,
        friends: entries,
        action: open.spaceIds().includes(spaceId) ? 'open' : 'join',
        onJoin: () => openSpaceDetail(router, spaceId),
      })
    );
  });
}
