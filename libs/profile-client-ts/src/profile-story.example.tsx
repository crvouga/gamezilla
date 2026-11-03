import { Button } from '@pkgs/ui-root-client-ts/button';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import type { ProfileIdentity } from './profile-screen-view';

/** Story fixtures: a fixed person whose own profile the stories show. */
export const STORY_PROFILE_ID = '7d3e5c1a-0000-4000-8000-000000000001';

/** Avery, with the default avatar look seeded from their id. */
export const STORY_IDENTITY: ProfileIdentity = {
  profileId: STORY_PROFILE_ID,
  username: 'avery',
  avatarConfig: { style: 'funEmoji', seed: STORY_PROFILE_ID, options: {} },
  isBot: false,
};

/**
 * Stand-in for the friends slot the friends sub fills in the app: a count
 * row. Profile cannot import friends, so stories draw the same shape.
 */
export function StoryFriendsStats(props: {
  readonly count: number;
}): JSX.Element {
  return (
    <MenuList>
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
    </MenuList>
  );
}

/** Stand-in for the friends actions slot: the Find friends pill. */
export function StoryFriendsActions(): JSX.Element {
  return (
    <Button
      title="Find friends"
      intent="neutral"
      variant="outline"
      flex={1}
      onClick={() => undefined}
    />
  );
}
