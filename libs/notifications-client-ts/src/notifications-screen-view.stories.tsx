/** @jsxImportSource solid-js */

import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
import { serializeDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { BellIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { NotificationsScreenView } from './notifications-screen-view';
import {
  storyCardActions,
  storyDefaultCard,
  storyNotification,
  storySections,
} from './notifications-story.example';

/**
 * Who a notification is about, with the default face every profile is
 * seeded with. The id is the one the space fixtures
 * (`spaces-story.example.tsx`) give the same person, so they wear the same
 * face in every story.
 */
function person(username: string, suffix: string) {
  return {
    fallbackLabel: `@${username}`,
    avatarConfig: serializeDefaultAvatarConfig(
      `5a1e0000-0000-4000-8000-0000000000${suffix}`
    ),
  };
}

/** A friend request waiting, with the inbox's own Accept / Decline. */
function friendRequest(
  id: string,
  who: readonly [username: string, suffix: string],
  createdAt: string,
  isUnread: boolean
) {
  const [username, suffix] = who;
  return storyNotification({
    id,
    sourceNamespace: 'friends',
    sourceType: 'friend-request',
    category: 'action_required',
    title: `@${username} sent you a friend request`,
    avatar: person(username, suffix),
    createdAt,
    isUnread,
    actions: [
      { id: 'accept', label: 'Accept', variant: 'solid' },
      { id: 'decline', label: 'Decline', variant: 'ghost' },
    ],
    deepLink: {
      path: '/profile/user/[userId]',
      params: { userId: `5a1e0000-0000-4000-8000-0000000000${suffix}` },
    },
  });
}

/** A daily game notice: whose turn it is, or how a game ended. */
function dailyGame(
  id: string,
  who: readonly [username: string, suffix: string],
  text: {
    readonly title: string;
    readonly body?: string;
    readonly createdAt: string;
    readonly isUnread: boolean;
  },
  ended: boolean
) {
  const [username, suffix] = who;
  return storyNotification({
    id,
    // The game platform's own namespace; the inbox never names a game.
    sourceNamespace: 'game-session',
    sourceType: ended ? 'multiplayer-result' : 'multiplayer-turn',
    category: ended ? 'informational' : 'action_required',
    avatar: person(username, suffix),
    ...text,
    actions: ended
      ? [{ id: 'dismiss', label: 'Dismiss', variant: 'ghost' }]
      : [],
    deepLink: { path: '/daily-game/multiplayer' },
  });
}

/** A friend request avery sent was accepted. */
function accepted(
  id: string,
  who: readonly [username: string, suffix: string],
  createdAt: string,
  isUnread: boolean
) {
  const [username, suffix] = who;
  return storyNotification({
    id,
    sourceNamespace: 'friends',
    sourceType: 'friend-request-accepted',
    title: `@${username} accepted your friend request`,
    avatar: person(username, suffix),
    createdAt,
    isUnread,
    deepLink: {
      path: '/profile/user/[userId]',
      params: { userId: `5a1e0000-0000-4000-8000-0000000000${suffix}` },
    },
  });
}

const JORDAN = ['jordan', '10'] as const;
const RILEY = ['riley_k', '12'] as const;
const ROBIN = ['robin_42', '04'] as const;
const SAM = ['sam', '05'] as const;
const MORGAN = ['morgan', '03'] as const;
const JORDAN_PLAYS = ['jordan_plays', '02'] as const;
const CASEY = ['casey', '09'] as const;

const ID = 'b51c7a90-0000-4000-8000-0000000000';

const NEEDS_YOU = [
  friendRequest(`${ID}01`, JORDAN, '2023-11-14T21:48:00.000Z', true),
  dailyGame(
    `${ID}02`,
    ROBIN,
    {
      title: "It's your turn in your daily game against @robin_42",
      createdAt: '2023-11-14T20:05:00.000Z',
      isUnread: true,
    },
    false
  ),
  dailyGame(
    `${ID}03`,
    SAM,
    {
      title: "You're low on time in your daily game against @sam",
      body: "It's your turn. You have 3 hours left to move.",
      createdAt: '2023-11-14T13:10:00.000Z',
      isUnread: true,
    },
    false
  ),
  friendRequest(`${ID}04`, RILEY, '2023-11-13T16:30:00.000Z', false),
];

const TODAY = [
  accepted(`${ID}05`, MORGAN, '2023-11-14T18:20:00.000Z', true),
  dailyGame(
    `${ID}06`,
    JORDAN_PLAYS,
    {
      title: 'You won your daily game against @jordan_plays',
      body: 'By resignation.',
      createdAt: '2023-11-14T15:45:00.000Z',
      isUnread: true,
    },
    true
  ),
];

const YESTERDAY = [
  dailyGame(
    `${ID}07`,
    ROBIN,
    {
      title: 'Your daily game against @robin_42 is drawn',
      body: 'Drawn by agreement.',
      createdAt: '2023-11-13T21:15:00.000Z',
      isUnread: false,
    },
    true
  ),
  accepted(`${ID}08`, CASEY, '2023-11-13T11:00:00.000Z', false),
];

const EARLIER = [
  dailyGame(
    `${ID}09`,
    SAM,
    {
      title: 'You lost your daily game against @sam',
      body: 'White ran out of time.',
      createdAt: '2023-11-11T19:30:00.000Z',
      isUnread: false,
    },
    true
  ),
  dailyGame(
    `${ID}10`,
    MORGAN,
    {
      title: 'Your daily game against @morgan was aborted',
      createdAt: '2023-11-09T08:40:00.000Z',
      isUnread: false,
    },
    true
  ),
];

const SECTIONS = storySections([
  ['Needs you', NEEDS_YOU],
  ['Today', TODAY],
  ['Yesterday', YESTERDAY],
  ['Earlier', EARLIER],
]);

/** The same week once every item has been read. */
const READ_SECTIONS = storySections([
  ['Yesterday', YESTERDAY],
  ['Earlier', EARLIER],
]);

const meta = {
  id: 'screens-notifications-inbox',
  title: 'Screens/Notifications/Inbox',
  component: NotificationsScreenView,
  tags: ['autodocs'],
  decorators: [withShippedModeration],
  parameters: {
    appRouter: true,
    controls: { exclude: ['sections', 'denial', 'renderCard'] },
  },
  args: {
    sections: SECTIONS,
    isLoading: false,
    filter: 'all',
    failure: null,
    markingAllRead: false,
    renderCard: storyDefaultCard(storyCardActions()),
    onFilterChange: fn(),
    onMarkAllRead: fn(),
  },
} satisfies Meta<typeof NotificationsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An active week. What needs you comes first, on every size: two friend
 * requests with Accept / Decline, and two daily games waiting on your move
 * (one low on time) with an explicit Open step. Then the Activity timeline
 * by day: a request accepted, games won, drawn, lost and aborted, each
 * result with its reason and a quiet Dismiss. Unread items lead with the
 * named accent dot, read ones have none, and every title keeps the body
 * weight. Only a card's own main answer (Accept) is solid; Open is an
 * outline. Archive is the quiet icon at each card's top trailing corner.
 * Every heading starts on the edge the title and the filter chips start on.
 * While anything is unread, Mark all read sits beside the title.
 */
export const Populated: Story = {};

/** Everything has been read: no Mark all read. */
export const AllRead: Story = { args: { sections: READ_SECTIONS } };

/** The first read has not finished; the inbox shows one activity indicator. */
export const Loading: Story = { args: { sections: [], isLoading: true } };

/** Known items stay visible while more are still loading below them. */
export const LoadingMore: Story = { args: { isLoading: true } };

/** Nothing in the inbox at all. */
export const Empty: Story = { args: { sections: [] } };

/** Nothing waits for a reply under Needs you. */
export const EmptyActionRequired: Story = {
  args: { sections: [], filter: 'action_required' },
};

/** Nothing archived yet. */
export const EmptyArchived: Story = {
  args: { sections: [], filter: 'archived' },
};

/** Mark all read is in flight: its button at the filter row's end shows it. */
export const MarkingAllRead: Story = { args: { markingAllRead: true } };

/** A choice failed because the device could not reach the inbox. */
export const ConnectionMissing: Story = {
  args: { failure: 'connection-missing' },
};

/** The inbox answered and refused the choice. */
export const ChoiceRefused: Story = { args: { failure: 'refused' } };

/** The inbox answered without making the change or saying why. */
export const ChoiceFailed: Story = { args: { failure: 'failed' } };

/** Long titles and bodies wrap to their line limits. */
export const LongContent: Story = {
  args: {
    sections: storySections([
      [
        'Today',
        [
          storyNotification({
            id: 'b51c7a90-0000-4000-8000-000000000005',
            title:
              '@a_really_long_username_that_keeps_going invited you to The Very Long Named Weekly Tournament Of Champions And Friends',
            body: 'Bring snacks. The tournament runs all evening and there will be several rounds of every game we have, so plan to stay a while.',
            avatar: { fallbackLabel: '@a_really_long_username' },
            isUnread: true,
          }),
        ],
      ],
    ]),
  },
};

/** A guest may not have an inbox: the sign-in way forward replaces it. */
export const Denied: Story = {
  args: {
    sections: [],
    denial: {
      icon: BellIcon,
      title: 'Sign in to get notifications',
      body: 'Friend requests and invites arrive here once you sign in.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: { testid: 'permission-denial', reason: 'requires_account' },
    },
  },
};

/** The filter chips switch what the inbox lists. */
export const ChangeFilter: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const needsYou = await canvas.findByRole('radio', { name: 'Needs you' });
    await userEvent.click(needsYou);
    await expect(args.onFilterChange).toHaveBeenCalledWith('action_required');
  },
};
