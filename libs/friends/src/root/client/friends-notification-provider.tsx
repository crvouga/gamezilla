import type {
  Notification,
  NotificationCardActions,
  NotificationProvider,
} from '@libs/notifications/public';
import { Show } from 'solid-js';

import { FriendRequestNotificationCard } from './friend-request-notification-card';
import type { FriendsClientDeps } from './friends-client-deps';

export function createFriendsNotificationProvider(
  _deps: FriendsClientDeps
): NotificationProvider {
  return {
    id: 'friends',
    renderCard: (
      interaction: Notification,
      actions: NotificationCardActions
    ) => (
      <Show when={interaction.sourceType === 'friend-request'}>
        <FriendRequestNotificationCard
          interaction={interaction}
          actions={actions}
        />
      </Show>
    ),
  };
}
