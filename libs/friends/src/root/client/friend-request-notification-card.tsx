import type {
  Notification,
  NotificationCardActions,
} from '@libs/notifications/public';
import { NotificationCardDefault } from '@libs/notifications/public';
import { Handles } from '@libs/test-ids';
import type { JSX } from 'solid-js';
import { createMemo, createSignal } from 'solid-js';
import { FriendProfileAvatar } from '../../public/friend-profile-avatar';
import { useFriendRequestDecisionOptional } from '../../public/friend-request-decision-state';
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
  const decision = useFriendRequestDecisionOptional();
  const [localOpen, setLocalOpen] = createSignal(false);
  const profile = createMemo(() =>
    profileFromFriendRequestNotification(interaction)
  );

  // Modal open state lives above the virtualized row when a provider is
  // present: row content remounts on data change (mark-read flips) and would
  // otherwise close the modal from under the user.
  const isOpen = (): boolean =>
    decision !== null ? decision.openId() === interaction.id : localOpen();
  const setOpen = (open: boolean): void => {
    if (decision !== null) {
      if (open) decision.open(interaction.id);
      else decision.close();
      return;
    }
    setLocalOpen(open);
  };

  const onPress = () => {
    void actions.markRead(interaction.id);
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
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
        visible={isOpen()}
        interaction={interaction}
        actions={actions}
        onClose={onClose}
      />
    </>
  );
}
