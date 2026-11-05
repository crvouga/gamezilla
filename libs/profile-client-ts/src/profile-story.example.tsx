import { createDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { UserPlusIcon, UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { MonogramTile } from '@pkgs/ui-root-client-ts/monogram-tile';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX } from 'solid-js';
import { DeviceAvatar } from './device-avatar';
import type { ProfileIdentity } from './profile-screen-view';

/** Story fixtures: a fixed person whose own profile the stories show. */
export const STORY_PROFILE_ID = '7d3e5c1a-0000-4000-8000-000000000001';

/** Seeds Avery's friendly default face, the one their space card shows. */
const STORY_AVATAR_SEED = '5a1e0000-0000-4000-8000-000000000001';

/** Avery, with a seeded default avatar look. */
export const STORY_IDENTITY: ProfileIdentity = {
  profileId: STORY_PROFILE_ID,
  username: 'avery',
  avatarConfig: createDefaultAvatarConfig(STORY_AVATAR_SEED),
  isBot: false,
};

/**
 * The story's friends, by the ids the space and friends-list fixtures give
 * the same people (the friends list story shows the same circle).
 */
const STORY_FRIENDS: readonly { readonly id: string; readonly name: string }[] =
  [
    { id: '02', name: 'jordan_plays' },
    { id: '03', name: 'morgan' },
    { id: '10', name: 'priya_k' },
    { id: '04', name: 'robin_42' },
    { id: '11', name: 'theo' },
    { id: '09', name: 'casey' },
    { id: '12', name: 'nadia' },
    { id: '05', name: 'sam' },
    { id: '13', name: 'kai_99' },
    { id: '14', name: 'ellis' },
    { id: '15', name: 'rowan_b' },
  ].map((friend) => ({
    id: `5a1e0000-0000-4000-8000-0000000000${friend.id}`,
    name: friend.name,
  }));

/** How many friends the story's person has: everyone in {@link STORY_FRIENDS}. */
export const STORY_FRIEND_COUNT = STORY_FRIENDS.length;

function storyFriend(name: string): {
  readonly id: string;
  readonly name: string;
} {
  const found = STORY_FRIENDS.find((friend) => friend.name === name);
  if (found === undefined) throw new Error(`no story friend ${name}`);
  return found;
}

function StoryFace(props: {
  readonly id: string;
  readonly name: string;
  readonly size: number;
}): JSX.Element {
  return (
    <DeviceAvatar
      avatarConfig={createDefaultAvatarConfig(props.id)}
      seedFallback={props.id}
      name={props.name}
      size={props.size}
    />
  );
}

/**
 * Stand-in for the friends slot the friends sub fills in the app: a bare
 * count row, the first faces at its end, that the profile puts in its
 * friends panel. Profile cannot import friends, so stories draw the same
 * shape.
 */
export function StoryFriendsStats(props: {
  readonly count: number;
}): JSX.Element {
  return (
    <MenuRow
      value={
        <AvatarGroup size={28} maxVisible={4} ringColor="surface">
          <For each={STORY_FRIENDS.slice(0, props.count)}>
            {(friend) => (
              <StoryFace id={friend.id} name={friend.name} size={28} />
            )}
          </For>
        </AvatarGroup>
      }
      leading={<UsersIcon size={20} color="icon" />}
      title={
        <>
          <Text variant="bodyBold" numeral>
            {String(props.count)}
          </Text>{' '}
          <Text tone="secondary">
            {props.count === 1 ? 'friend' : 'friends'}
          </Text>
        </>
      }
      onClick={() => undefined}
    />
  );
}

/** Stand-in for the friends actions slot: the Find friends row. */
export function StoryFriendsActions(): JSX.Element {
  return (
    <MenuRow
      title="Find friends"
      caption="Search by username"
      leading={<UserPlusIcon size={20} color="tint" />}
      onClick={() => undefined}
    />
  );
}

/**
 * The rooms friends are in right now, as the friends list story has them:
 * jordan_plays hosts "Friday chess" with robin_42 and theo, sam hosts
 * "Quick connect four" with priya_k, and morgan hosts a space with no name
 * of its own, which goes by theirs.
 */
const STORY_ROOMS = [
  {
    spaceId: '5bace000-0000-4000-8000-000000000010',
    title: 'Friday chess',
    caption: 'jordan_plays hosts',
    people: ['jordan_plays', 'robin_42', 'theo'],
  },
  {
    spaceId: '5bace000-0000-4000-8000-000000000011',
    title: 'Quick connect four',
    caption: 'sam hosts',
    people: ['sam', 'priya_k'],
  },
  {
    spaceId: '5bace000-0000-4000-8000-000000000012',
    title: "morgan's space",
    caption: 'morgan hosts',
    people: ['morgan'],
  },
].map((room) => ({ ...room, people: room.people.map(storyFriend) }));

/**
 * Stand-in for the playing slot: the rooms friends are in right now, each
 * by its tile and name, who of them is there (their faces and who hosts)
 * and one Join (the friends sub draws the same rows).
 */
export function StoryFriendsPlaying(): JSX.Element {
  return (
    <MenuSection title="Playing now">
      <For each={STORY_ROOMS}>
        {(room) => (
          <MenuRow
            leading={
              <MonogramTile name={room.title} seed={room.spaceId} size="md" />
            }
            title={room.title}
            caption={
              <StackHorizontal align="center" gap="xs">
                <AvatarGroup size={20} maxVisible={3} ringColor="surface">
                  <For each={room.people}>
                    {(friend) => (
                      <StoryFace id={friend.id} name={friend.name} size={20} />
                    )}
                  </For>
                </AvatarGroup>
                <P variant="caption" lines={1}>
                  {room.caption}
                </P>
              </StackHorizontal>
            }
            trailing={
              <Button
                title="Join"
                intent="neutral"
                variant="outline"
                size="sm"
                onClick={() => undefined}
              />
            }
          />
        )}
      </For>
    </MenuSection>
  );
}
