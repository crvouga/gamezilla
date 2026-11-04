import type { Friend } from '@libs/friends-shared-ts/friends-types';
import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
import { serializeDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FriendsListScreenView } from './friends-list-screen-view';

/**
 * A friend with the default face every profile is seeded with
 * (`synced: false` for one whose profile has not reached this device, which
 * shows their initials).
 */
function friend(
  userId: string,
  username: string,
  since: string,
  options: { readonly synced?: boolean } = {}
): Friend {
  return {
    userId,
    username,
    avatarConfig:
      options.synced === false ? null : serializeDefaultAvatarConfig(userId),
    friendsSince: since,
  };
}

/** Friends made over the past year and more, newest first. */
const FRIENDS: readonly Friend[] = [
  friend(
    '9f1c2a4e-0000-4000-8000-000000000001',
    'avery',
    '2026-10-21T18:30:00.000Z'
  ),
  friend(
    '9f1c2a4e-0000-4000-8000-000000000002',
    'jordan_plays',
    '2026-08-03T12:00:00.000Z'
  ),
  friend(
    '9f1c2a4e-0000-4000-8000-000000000003',
    'morgan',
    '2026-04-12T09:15:00.000Z'
  ),
  friend(
    '9f1c2a4e-0000-4000-8000-000000000004',
    'robin_42',
    '2026-01-15T12:00:00.000Z',
    { synced: false }
  ),
  friend(
    '9f1c2a4e-0000-4000-8000-000000000005',
    'sam',
    '2025-09-30T20:45:00.000Z'
  ),
];

const meta = {
  id: 'screens-friends-list',
  title: 'Screens/Friends/Friends list',
  component: FriendsListScreenView,
  tags: ['autodocs'],
  decorators: [withShippedModeration],
  parameters: {
    appRouter: true,
    controls: { exclude: ['friends', 'denial', 'notice', 'friendTrailing'] },
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
const HOSTING = new Set(['9f1c2a4e-0000-4000-8000-000000000002']);

/**
 * Friends are known: one row each, newest-first order as the container gives
 * it. Each row is the friend's face, name and since when, and opens their
 * profile; a friend hosting a live space ends in the Live tag that joins it
 * (a profile not yet on this device shows its initials).
 */
export const Populated: Story = {
  args: {
    friendTrailing: (item) =>
      HOSTING.has(item.userId) ? <LiveBadge /> : undefined,
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
        '9f1c2a4e-0000-4000-8000-000000000006',
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

/** Pressing a friend opens that friend; the empty state's action opens search. */
export const OpenFriend: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('@morgan'));
    await expect(args.onOpenFriend).toHaveBeenCalledWith(FRIENDS[2]);
  },
};
