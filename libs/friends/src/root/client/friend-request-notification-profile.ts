import type { Notification } from '@libs/notifications/public';

export type FriendRequestNotificationProfile = {
  userId: string;
  username: string;
  avatarConfig: string | null;
};

export function profileFromFriendRequestNotification(
  interaction: Notification
): FriendRequestNotificationProfile {
  const fromUserId = interaction.payload['fromUserId'];
  const fromUsername = interaction.payload['fromUsername'];
  const userId =
    typeof fromUserId === 'string' && fromUserId.length > 0
      ? fromUserId
      : (interaction.deepLink?.params?.['userId'] ?? '');
  const username = typeof fromUsername === 'string' ? fromUsername : '';
  const avatarConfig = interaction.avatar?.avatarConfig ?? null;
  return { userId, username, avatarConfig };
}
