import type {
  Notification,
  NotificationCardActions,
  NotificationProvider,
} from '@libs/notifications/public';

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
    ) => {
      if (interaction.sourceType === 'friend-request') {
        return (
          <FriendRequestNotificationCard
            interaction={interaction}
            actions={actions}
          />
        );
      }
      return null;
    },
  };
}
