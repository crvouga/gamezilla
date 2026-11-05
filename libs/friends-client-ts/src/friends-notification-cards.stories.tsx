import { withShippedModeration } from '@libs/moderation-client-ts/moderation-story.example';
import { NotificationsScreenView } from '@libs/notifications-client-ts/notifications-screen-view';
import {
  storyCardActions,
  storyDefaultCard,
  storyNotification,
  storySections,
} from '@libs/notifications-client-ts/notifications-story.example';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import { serializeDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { JSX } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FriendAcceptedNotificationCard } from './friend-accepted-notification-card';
import { FriendRequestNotificationCard } from './friend-request-notification-card';

/**
 * Ids the space fixtures (`spaces-story.example.tsx`) give the same people,
 * so they wear the same face in every story. The viewer here is not avery:
 * avery is the one asking.
 */
const AVERY_ID = '5a1e0000-0000-4000-8000-000000000001';
const ROBIN_ID = '5a1e0000-0000-4000-8000-000000000004';

const REQUEST = storyNotification({
  id: 'c7a2e410-0000-4000-8000-000000000001',
  sourceNamespace: 'friends',
  sourceType: 'friend-request',
  category: 'action_required',
  title: '@avery sent you a friend request',
  avatar: {
    fallbackLabel: '@avery',
    avatarConfig: serializeDefaultAvatarConfig(AVERY_ID),
  },
  isUnread: true,
  payload: { fromUserId: AVERY_ID, fromUsername: 'avery' },
  actions: [
    { id: 'accept', label: 'Accept', variant: 'solid' },
    { id: 'decline', label: 'Decline', variant: 'ghost' },
  ],
  deepLink: { path: '/profile/user/[userId]', params: { userId: AVERY_ID } },
});

const ACCEPTED = storyNotification({
  id: 'c7a2e410-0000-4000-8000-000000000002',
  sourceNamespace: 'friends',
  sourceType: 'friend-request-accepted',
  title: '@robin_42 accepted your friend request',
  avatar: {
    fallbackLabel: '@robin_42',
    avatarConfig: serializeDefaultAvatarConfig(ROBIN_ID),
  },
  createdAt: '2023-11-13T19:00:00.000Z',
  payload: { toUserId: ROBIN_ID, toUsername: 'robin_42' },
  deepLink: { path: '/profile/user/[userId]', params: { userId: ROBIN_ID } },
});

const ACTIONS = storyCardActions();
const defaultCard = storyDefaultCard(ACTIONS);

/** Friends draws its own two cards; anything else gets the default card. */
function renderCard(interaction: Notification): JSX.Element {
  if (interaction.sourceType === 'friend-request') {
    return (
      <FriendRequestNotificationCard
        interaction={interaction}
        actions={ACTIONS}
      />
    );
  }
  if (interaction.sourceType === 'friend-request-accepted') {
    return (
      <FriendAcceptedNotificationCard
        interaction={interaction}
        actions={ACTIONS}
      />
    );
  }
  return defaultCard(interaction);
}

const SECTIONS = storySections([
  ['Today', [REQUEST]],
  ['Yesterday', [ACCEPTED]],
]);

/**
 * Friends' own inbox cards, shown in the inbox they appear in. The card is
 * the component under test; the inbox around it is the notifications view.
 */
const meta = {
  id: 'screens-notifications-friends',
  title: 'Screens/Notifications/Friend notifications',
  component: FriendRequestNotificationCard,
  tags: ['autodocs'],
  decorators: [withShippedModeration],
  parameters: {
    appRouter: true,
    controls: { exclude: ['interaction', 'actions'] },
  },
  args: { interaction: REQUEST, actions: ACTIONS },
  render: () => (
    <NotificationsScreenView
      sections={SECTIONS}
      isLoading={false}
      filter="all"
      failure={null}
      markingAllRead={false}
      renderCard={renderCard}
      onFilterChange={fn()}
      onMarkAllRead={fn()}
    />
  ),
} satisfies Meta<typeof FriendRequestNotificationCard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A friend request (opens a decision) and an accepted request (opens the profile). */
export const FriendCards: Story = {};

/** Pressing a friend request opens Accept / Decline with the sender's profile. */
export const FriendRequestDecision: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.notificationsFriendRequestCard('avery'))
    );
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Friend request')).toBeVisible();
    await expect(ACTIONS.markRead).toHaveBeenCalledWith(REQUEST.id);
  },
};
