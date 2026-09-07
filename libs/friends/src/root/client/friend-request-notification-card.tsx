import type {
  Notification,
  NotificationCardActions,
} from '@libs/notifications/public';
import { NotificationCardDefault } from '@libs/notifications/public';
import { Handles } from '@libs/test-ids';
import type { JSX } from 'solid-js';
import { createMemo, createSignal } from 'solid-js';

import { FriendProfileAvatar } from '../../public/friend-profile-avatar';
import { FriendRequestDecisionModal } from './friend-request-decision-modal';
import { profileFromFriendRequestNotification } from './friend-request-notification-profile';

type FriendRequestNotificationCardProps = {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
};

export function FriendRequestNotificationCard({
  interaction,
  actions,
}: FriendRequestNotificationCardProps): JSX.Element {
  const [modalOpen, setModalOpen] = createSignal(false);
  const profile = createMemo(() =>
    profileFromFriendRequestNotification(interaction)
  );

  const onPress = () => {
    void actions.markRead(interaction.id);
    setModalOpen(true);
  };

  const onClose = () => {
    setModalOpen(false);
  };

  const leading = () =>
    profile().userId.length > 0 ? (
      <FriendProfileAvatar profile={profile()} size={48} />
    ) : undefined;

  return (
    <>
      <NotificationCardDefault
        interaction={interaction}
        actions={actions}
        showInlineActions={false}
        onPress={onPress}
        {...(leading() !== undefined ? { leading: leading() } : {})}
        {...(profile().username.length > 0
          ? {
              testID: Handles.notificationsFriendRequestCard(
                profile().username
              ),
            }
          : {})}
      />
      <FriendRequestDecisionModal
        visible={modalOpen()}
        interaction={interaction}
        actions={actions}
        onClose={onClose}
      />
    </>
  );
}
