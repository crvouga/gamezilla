import type { Friend } from '@libs/friends-shared-ts/friends-types';
import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
import { serializeDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import {
  FriendLiveSpaceJoinView,
  FriendLiveSpaceStatusView,
} from '@libs/spaces-client-ts/friend-live-space';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FriendsListScreenView } from './friends-list-screen-view';

/**
 * Story people share one id each with the space fixtures
 * (`spaces-story.example.tsx`), so a person wears the same face in every
 * story: friends, search, the inbox and a space.
 */
function personId(suffix: string): string {
  return `5a1e0000-0000-4000-8000-0000000000${suffix}`;
}

/**
 * A friend with the default face every profile is seeded with
 * (`synced: false` for one whose profile has not reached this device, which
 * shows their initials).
 */
function friend(
  suffix: string,
  username: string,
  since: string,
  options: { readonly synced?: boolean } = {}
): Friend {
  const userId = personId(suffix);
  return {
    userId,
    username,
    avatarConfig:
      options.synced === false ? null : serializeDefaultAvatarConfig(userId),
    friendsSince: since,
  };
}

/**
 * The signed-in viewer's (avery's) friends, newest first: never the viewer
 * themselves.
 */
const FRIENDS: readonly Friend[] = [
  friend('02', 'jordan_plays', '2026-08-03T12:00:00.000Z'),
  friend('03', 'morgan', '2026-04-12T09:15:00.000Z'),
  friend('04', 'robin_42', '2026-01-15T12:00:00.000Z'),
  friend('09', 'casey', '2025-12-02T17:00:00.000Z', { synced: false }),
  friend('05', 'sam', '2025-09-30T20:45:00.000Z'),
];

const meta = {
  id: 'screens-friends-list',
  title: 'Screens/Friends/Friends list',
  component: FriendsListScreenView,
  tags: ['autodocs'],
  decorators: [withShippedModeration],
  parameters: {
    appRouter: true,
    controls: {
      exclude: [
        'friends',
        'denial',
        'notice',
        'friendStatus',
        'friendTrailing',
      ],
    },
  },
  args: {
    status: 'ready',
    friends: FRIENDS,
    onOpenFriend: fn(),
    onFindFriends: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof FriendsListScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Who is hosting a live space right now: the app's live-space tag. */
const HOSTING = new Set([personId('02'), personId('05')]);

/**
 * Friends are known: one row each, newest-first order as the container gives
 * it. Each row is the friend's face and name, and opens their profile; a
 * friend hosting a live space says so under their name ("Hosting a space",
 * with the online dot) and ends in Join, which goes in (a profile not yet on
 * this device shows its initials). No friendship date: the row says what
 * helps you play now. Find friends sits in the header as the page's next
 * step.
 */
export const Populated: Story = {
  args: {
    friendStatus: (item) =>
      HOSTING.has(item.userId) ? (
        <FriendLiveSpaceStatusView hosting />
      ) : undefined,
    friendTrailing: (item) =>
      HOSTING.has(item.userId) ? (
        <FriendLiveSpaceJoinView
          action="join"
          onPress={fn()}
          hostAccountId={item.userId}
        />
      ) : undefined,
  },
};

/** The first read has not finished; the list shows one activity indicator. */
export const Loading: Story = { args: { status: 'loading', friends: [] } };

/** No friends yet: the empty state points at search, the way to make one. */
export const Empty: Story = { args: { friends: [] } };

/** The first sync failed with nothing cached; retry asks for the data again. */
export const Failed: Story = { args: { status: 'failed', friends: [] } };

/** Cached friends stay visible even while a later refresh is failing. */
export const FailedWithCachedFriends: Story = { args: { status: 'failed' } };

/** Long names truncate to one line instead of pushing the row apart. */
export const LongNames: Story = {
  args: {
    friends: [
      friend(
        '08',
        'a_really_long_username_that_keeps_going_and_going',
        '2026-11-01T10:00:00.000Z'
      ),
      ...FRIENDS,
    ],
  },
};

/** An anonymous person sees the sign-in way forward instead of the list. */
export const Denied: Story = {
  args: {
    friends: [],
    denial: {
      icon: UsersIcon,
      title: 'Sign in to add friends',
      body: 'Friends let you find each other and jump into shared spaces.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: { testid: 'permission-denial', reason: 'requires_account' },
    },
  },
};

/**
 * Pressing a friend opens that friend; Find friends in the header (like the
 * empty state's action) opens search.
 */
export const OpenFriend: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('@morgan'));
    await expect(args.onOpenFriend).toHaveBeenCalledWith(FRIENDS[1]);
    const find = await canvas.findByRole('button', { name: 'Find friends' });
    await userEvent.click(find);
    await expect(args.onFindFriends).toHaveBeenCalled();
  },
};
