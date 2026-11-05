import type { Friend } from '@libs/friends-shared-ts/friends-types';
import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
import { serializeDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { FriendLiveSpaceJoinView } from '@libs/spaces-client-ts/friend-live-space';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { Show } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  FriendRequestRow,
  FriendRequestsAsideView,
} from './friend-requests-aside';
import { FriendsListScreenView } from './friends-list-screen-view';
import {
  FriendRoomStatusView,
  liveFriendsFirst,
  type PlayingRoom,
  roomsByFriend,
} from './friends-playing-now';

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
 * themselves. An active player's circle: a dozen people, about half of them
 * in a room right now, one whose profile has not reached this device yet.
 */
const FRIENDS: readonly Friend[] = [
  friend('02', 'jordan_plays', '2026-08-03T12:00:00.000Z'),
  friend('03', 'morgan', '2026-04-12T09:15:00.000Z'),
  friend('10', 'priya_k', '2026-03-28T18:30:00.000Z'),
  friend('04', 'robin_42', '2026-01-15T12:00:00.000Z'),
  friend('11', 'theo', '2025-12-20T21:10:00.000Z'),
  friend('09', 'casey', '2025-12-02T17:00:00.000Z', { synced: false }),
  friend('12', 'nadia', '2025-11-08T14:00:00.000Z'),
  friend('05', 'sam', '2025-09-30T20:45:00.000Z'),
  friend('13', 'kai_99', '2025-08-17T16:20:00.000Z'),
  friend('14', 'ellis', '2025-06-02T19:05:00.000Z'),
  friend('15', 'rowan_b', '2025-03-11T11:40:00.000Z'),
];

function friendNamed(username: string): Friend {
  const found = FRIENDS.find((entry) => entry.username === username);
  if (found === undefined) throw new Error(`no story friend ${username}`);
  return found;
}

/**
 * The rooms friends are in right now, as the space fixtures name them:
 * jordan_plays hosts "Friday chess" (robin_42 and theo with them), sam
 * hosts "Quick connect four" (priya_k with them) — the rooms their invites
 * in the inbox name — and morgan hosts a space with no name of its own,
 * which goes by theirs.
 */
function storyRooms(): readonly PlayingRoom[] {
  return [
    {
      spaceId: '5bace000-0000-4000-8000-000000000010',
      title: 'Friday chess',
      friends: [
        { friend: friendNamed('jordan_plays'), hosting: true },
        { friend: friendNamed('robin_42'), hosting: false },
        { friend: friendNamed('theo'), hosting: false },
      ],
      action: 'join',
      onJoin: fn(),
    },
    {
      spaceId: '5bace000-0000-4000-8000-000000000011',
      title: 'Quick connect four',
      friends: [
        { friend: friendNamed('sam'), hosting: true },
        { friend: friendNamed('priya_k'), hosting: false },
      ],
      action: 'join',
      onJoin: fn(),
    },
    {
      spaceId: '5bace000-0000-4000-8000-000000000012',
      title: null,
      friends: [{ friend: friendNamed('morgan'), hosting: true }],
      action: 'join',
      onJoin: fn(),
    },
  ];
}

/** Who is in a live space right now: the room each is in, and whether they host it. */
const LIVE = roomsByFriend(storyRooms());

/** The list as the container orders it: hosts, then guests, then the rest. */
const LIVE_FIRST: readonly Friend[] = liveFriendsFirst(FRIENDS, LIVE);

/**
 * People who asked avery to be friends and are waiting on an answer (one
 * more avery sent is still waiting on them).
 */
const ASKERS: readonly Friend[] = [
  friend('16', 'quinn', '2026-11-03T09:00:00.000Z'),
  friend('17', 'dana_r', '2026-11-01T18:00:00.000Z'),
];

function askerById(userId: string): Friend {
  const found = ASKERS.find((entry) => entry.userId === userId);
  if (found === undefined) throw new Error(`no story asker ${userId}`);
  return found;
}

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
        'aside',
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

/**
 * Friends are known: one row each, whoever you can play with now first
 * (hosts, then guests, then the rest). Each row is the friend's face and
 * name, and opens their profile; a friend in a live space says which room
 * under their name — the room's own tile, then "Hosting Friday chess" with
 * the online dot — and ends in Join, which goes in; every other row ends
 * in the chevron, so a row never offers two targets (a profile not yet on
 * this device shows its initials). On a desktop the friend requests
 * waiting on an answer sit in a column beside the list; Join lives only on
 * the rows. Find friends sits in the header as the page's next step.
 */
export const Populated: Story = {
  args: {
    friends: LIVE_FIRST,
    friendStatus: (item) => (
      <Show when={LIVE.get(item.userId)}>
        {(live) => (
          <FriendRoomStatusView room={live().room} hosting={live().hosting} />
        )}
      </Show>
    ),
    friendTrailing: (item) =>
      LIVE.has(item.userId) ? (
        <FriendLiveSpaceJoinView
          action="join"
          onPress={fn()}
          hostAccountId={item.userId}
        />
      ) : undefined,
  },
  render: (args) => (
    <FriendsListScreenView
      {...args}
      aside={
        <FriendRequestsAsideView
          incomingIds={ASKERS.map((entry) => entry.userId)}
          outgoingCount={1}
          request={(userId) => (
            <FriendRequestRow profile={askerById(userId)} onOpen={fn()} />
          )}
        />
      }
    />
  ),
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
