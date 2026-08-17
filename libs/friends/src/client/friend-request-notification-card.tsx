import { Handles } from '@libs/dst-handles';
import type {
  Notification,
  NotificationCardActions,
} from '@libs/notifications/client';
import { NotificationCardDefault } from '@libs/notifications/client';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { FriendProfileAvatar } from './friend-profile-avatar';
import { FriendRequestDecisionModal } from './friend-request-decision-modal';
import { profileFromFriendRequestNotification } from './friend-request-notification-profile';

type FriendRequestNotificationCardProps = {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
};

export function FriendRequestNotificationCard({
  interaction,
  actions,
}: FriendRequestNotificationCardProps): ReactNode {
  const [modalOpen, setModalOpen] = useState(false);
  const profile = useMemo(
    () => profileFromFriendRequestNotification(interaction),
    [interaction]
  );

  const onPress = useCallback(() => {
    void actions.markRead(interaction.id);
    setModalOpen(true);
  }, [actions, interaction.id]);

  const onClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  const leading =
    profile.userId.length > 0 ? (
      <FriendProfileAvatar profile={profile} size={48} />
    ) : undefined;

  return (
    <>
      <NotificationCardDefault
        interaction={interaction}
        actions={actions}
        showInlineActions={false}
        onPress={onPress}
        {...(leading !== undefined ? { leading } : {})}
        {...(profile.username.length > 0
          ? { testID: Handles.notificationsFriendRequestCard(profile.username) }
          : {})}
      />
      <FriendRequestDecisionModal
        visible={modalOpen}
        interaction={interaction}
        actions={actions}
        onClose={onClose}
      />
    </>
  );
}
