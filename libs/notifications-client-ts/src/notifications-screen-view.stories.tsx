/** @jsxImportSource solid-js */

import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
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

const INVITE = storyNotification({
  id: 'b51c7a90-0000-4000-8000-000000000001',
  category: 'action_required',
  title: '@jordan_plays invited you to Friday chess',
  subtitle: 'Space invite',
  avatar: { fallbackLabel: '@jordan_plays' },
  isUnread: true,
  actions: [
    { id: 'accept', label: 'Join', variant: 'ghost' },
    { id: 'decline', label: 'Decline', variant: 'ghost', destructive: true },
  ],
});

const STARTED = storyNotification({
  id: 'b51c7a90-0000-4000-8000-000000000002',
  sourceType: 'space_started',
  title: '@morgan started a space',
  body: 'Tap to watch or join the next game.',
  avatar: { fallbackLabel: '@morgan' },
  createdAt: '2023-11-14T18:30:00.000Z',
  isUnread: true,
  deepLink: { path: '/spaces/[spaceId]', params: { spaceId: 'friday-chess' } },
});

const DISABLED = storyNotification({
  id: 'b51c7a90-0000-4000-8000-000000000003',
  category: 'action_required',
  title: '@sam invited you to Quick connect four',
  subtitle: 'The space is full',
  avatar: { fallbackLabel: '@sam' },
  createdAt: '2023-11-13T20:00:00.000Z',
  actions: [
    {
      id: 'accept',
      label: 'Join',
      variant: 'ghost',
      disabled: true,
      disabledReason: 'The space is full',
    },
  ],
});

const SYSTEM = storyNotification({
  id: 'b51c7a90-0000-4000-8000-000000000004',
  sourceNamespace: 'app',
  sourceType: 'release_notes',
  category: 'system',
  title: 'Puzzles now remember where you left off',
  createdAt: '2023-11-02T09:00:00.000Z',
});

const SECTIONS = storySections([
  ['Today', [INVITE, STARTED]],
  ['Yesterday', [DISABLED]],
  ['Earlier', [SYSTEM]],
]);

const READ_SECTIONS = storySections([
  ['Yesterday', [DISABLED]],
  ['Earlier', [SYSTEM]],
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
 * The inbox by day: an invite with Join / Decline, an unread update that
 * opens its space, a disabled action, and a system note. Unread items put
 * Mark all read in the header.
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

/** Nothing waits for a reply under Action required. */
export const EmptyActionRequired: Story = {
  args: { sections: [], filter: 'action_required' },
};

/** Nothing archived yet. */
export const EmptyArchived: Story = {
  args: { sections: [], filter: 'archived' },
};

/** Mark all read is in flight: the header action shows it. */
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
    await userEvent.click(await canvas.findByText('Action required'));
    await expect(args.onFilterChange).toHaveBeenCalledWith('action_required');
  },
};
