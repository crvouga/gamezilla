import type { FriendProfile } from '@libs/friends-shared-ts/friends-types';
import { useModeration } from '@libs/moderation-client-ts/moderation-context';
import { usernameLabel } from '@libs/moderation-shared-ts/display';
import {
  type FriendLiveSpaceAction,
  FriendLiveSpaceJoinView,
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
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';

const FACE_SIZE = 28;
const FACES_SHOWN = 3;

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
function useRoomTitle(room: () => PlayingRoom): () => string {
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
 * Who of your friends is there, short enough for the narrow column:
 * "jordan_plays hosts, with robin_42", or the names of those in it.
 */
function useRoomCaption(room: () => PlayingRoom): () => string {
  const { t } = useLingui();
  const names = useNames(() => room().friends, false);
  return () => {
    const all = names();
    if (room().friends[0]?.hosting !== true) return all.join(', ');
    const host = all[0] ?? '';
    const others = all.slice(1).join(', ');
    return others.length > 0
      ? t`${host} hosts, with ${others}`
      : t`${host} hosts`;
  };
}

function PlayingRoomRow(props: { readonly room: PlayingRoom }): JSX.Element {
  const title = useRoomTitle(() => props.room);
  const caption = useRoomCaption(() => props.room);
  const names = useNames(() => props.room.friends, true);
  return (
    <MenuRow
      leading={
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
      }
      title={title()}
      caption={caption()}
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
 * "Playing now" by room, for the desktop column beside the friends list:
 * each live space friends are in, by its name, who of them is there, and
 * Join. Every Join here is also on that friend's row, so a phone (which has
 * no column) loses nothing. Nothing at all while nobody is playing.
 */
export function FriendsPlayingNowView(props: {
  readonly rooms: readonly PlayingRoom[];
}): JSX.Element {
  return (
    <Show when={props.rooms.length > 0}>
      <MenuSection title={<Trans>Playing now</Trans>}>
        <For each={props.rooms}>{(room) => <PlayingRoomRow room={room} />}</For>
      </MenuSection>
    </Show>
  );
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
        action: open.spaceIds().includes(spaceId) ? 'resume' : 'join',
        onJoin: () => openSpaceDetail(router, spaceId),
      })
    );
  });
}
