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
import { Trans } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';
import { liveFriendsFirst } from './friends-playing-now';
import { useFriends } from './use-friends';

const FACE_SIZE = 32;
/** A profile lists a few; the friends list has everyone. */
const PLAYING_SHOWN = 3;

/** One friend in a live space, and what pressing Join does. */
export type FriendPlaying = {
  readonly friend: FriendProfile;
  readonly hosting: boolean;
  /** The room's own name, when it has one ("Hosting Friday chess"). */
  readonly title?: string | null | undefined;
  readonly action: FriendLiveSpaceAction;
  readonly onJoin: () => void;
};

function FriendPlayingRow(props: { readonly playing: FriendPlaying }) {
  const moderation = useModeration();
  const name = createMemo(() =>
    usernameLabel(
      moderation(),
      props.playing.friend.username,
      props.playing.friend.userId
    )
  );
  return (
    <MenuRow
      leading={
        <FriendProfileAvatar
          profile={props.playing.friend}
          name={name()}
          size={FACE_SIZE}
        />
      }
      title={name()}
      caption={
        <FriendLiveSpaceStatusView
          hosting={props.playing.hosting}
          title={props.playing.title}
        />
      }
      trailing={
        <FriendLiveSpaceJoinView
          action={props.playing.action}
          onPress={() => props.playing.onJoin()}
        />
      }
    />
  );
}

/**
 * "Playing now" on the person's own profile: the friends in a live space
 * right now, hosts first, each with the room they are in and Join. Nothing at all while
 * nobody is, so the profile never shows an empty panel.
 */
export function ProfileFriendsPlayingView(props: {
  readonly playing: readonly FriendPlaying[];
}): JSX.Element {
  return (
    <Show when={props.playing.length > 0}>
      <MenuSection title={<Trans>Playing now</Trans>}>
        <For each={props.playing.slice(0, PLAYING_SHOWN)}>
          {(playing) => <FriendPlayingRow playing={playing} />}
        </For>
      </MenuSection>
    </Show>
  );
}

/** Fills the profile's playing slot from synced friends and live spaces. */
export function ProfileFriendsPlaying(): JSX.Element {
  const router = useRouter();
  const friendsState = useFriends();
  const live = useLiveSpacesByPerson();
  const titles = useLiveSpaceTitles();
  const open = useOpenSpaceSessionIds();
  const playing = createMemo((): readonly FriendPlaying[] =>
    liveFriendsFirst(friendsState.friends(), live()).flatMap((friend) => {
      const space = live().get(friend.userId);
      if (space === undefined) return [];
      return [
        {
          friend,
          hosting: space.hosting,
          title: titles().get(space.spaceId) ?? null,
          action: open.spaceIds().includes(space.spaceId) ? 'resume' : 'join',
          onJoin: () => openSpaceDetail(router, space.spaceId),
        },
      ];
    })
  );
  return <ProfileFriendsPlayingView playing={playing()} />;
}
