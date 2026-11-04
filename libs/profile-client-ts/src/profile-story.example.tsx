import { createDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { UserPlusIcon, UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
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

/** The story's friends, by the ids the space fixtures give the same people. */
const STORY_FRIENDS: readonly { readonly id: string; readonly name: string }[] =
  [
    { id: '02', name: 'jordan_plays' },
    { id: '03', name: 'morgan' },
    { id: '04', name: 'robin_42' },
    { id: '05', name: 'sam' },
    { id: '08', name: 'casey' },
  ].map((friend) => ({
    id: `5a1e0000-0000-4000-8000-0000000000${friend.id}`,
    name: friend.name,
  }));

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
 * Stand-in for the playing slot: friends in a live space right now, each
 * with what they are doing and Join (the friends sub draws the same rows).
 */
export function StoryFriendsPlaying(): JSX.Element {
  const playing = [
    { ...STORY_FRIENDS[0], doing: 'Hosting a space' },
    { ...STORY_FRIENDS[3], doing: 'In a space' },
  ];
  return (
    <MenuSection title="Playing now">
      <For each={playing}>
        {(friend) => (
          <MenuRow
            leading={
              <StoryFace
                id={friend.id ?? ''}
                name={friend.name ?? ''}
                size={32}
              />
            }
            title={`@${friend.name ?? ''}`}
            caption={
              <StackHorizontal align="center" gap="xs">
                <StatusDot status="online" size={8} />
                <P variant="caption" lines={1}>
                  {friend.doing}
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
