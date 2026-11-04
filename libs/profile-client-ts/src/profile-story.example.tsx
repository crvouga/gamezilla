import { UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import type { ProfileIdentity } from './profile-screen-view';

/** Story fixtures: a fixed person whose own profile the stories show. */
export const STORY_PROFILE_ID = '7d3e5c1a-0000-4000-8000-000000000001';

/** Seeds Avery's friendly default face, the one their space card shows. */
const STORY_AVATAR_SEED = '5a1e0000-0000-4000-8000-000000000001';

/** Avery, with a seeded default avatar look. */
export const STORY_IDENTITY: ProfileIdentity = {
  profileId: STORY_PROFILE_ID,
  username: 'avery',
  avatarConfig: { style: 'funEmoji', seed: STORY_AVATAR_SEED, options: {} },
  isBot: false,
};

/**
 * Stand-in for the friends slot the friends sub fills in the app: a bare
 * count row the profile puts in its friends panel. Profile cannot import
 * friends, so stories draw the same shape.
 */
export function StoryFriendsStats(props: {
  readonly count: number;
}): JSX.Element {
  return (
    <MenuRow
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
