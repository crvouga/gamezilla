import type { Notification } from '@libs/notifications-shared/notification';
import type { NotificationCardActions } from '@libs/notifications-shared/notification-action';
import { NotificationCardDefault } from '@libs/notifications-client/notification-card-default';
import { Handles } from '@libs/test-ids-shared/handles';
import type { JSX } from 'solid-js';
import { createMemo, createSignal, Show } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';
import { useFriendRequestDecisionOptional } from './friend-request-decision-state';
import { FriendRequestDecisionModal } from './friend-request-decision-modal';
import { profileFromFriendRequestNotification } from './friend-request-notification-profile';

type FriendRequestNotificationCardProps = {
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
};

export function FriendRequestNotificationCard(
  props: FriendRequestNotificationCardProps
): JSX.Element {
  const decision = useFriendRequestDecisionOptional();
  const [localOpen, setLocalOpen] = createSignal(false);
  const profile = createMemo(() =>
    profileFromFriendRequestNotification(props.interaction)
  );

  // Modal open state lives above the virtualized row when a provider is
  // present: row content remounts on data change (mark-read flips) and would
  // otherwise close the modal from under the user.
  const isOpen = (): boolean =>
    decision !== null
      ? decision.openId() === props.interaction.id
      : localOpen();
  const setOpen = (open: boolean): void => {
    if (decision !== null) {
      if (open) decision.open(props.interaction, props.actions);
      else decision.close();
      return;
    }
    setLocalOpen(open);
  };

  const onPress = () => {
    void props.actions.markRead(props.interaction.id);
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
        interaction={props.interaction}
        actions={props.actions}
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
      <Show when={decision === null}>
        <FriendRequestDecisionModal
          visible={isOpen()}
          interaction={props.interaction}
          actions={props.actions}
          onClose={onClose}
        />
      </Show>
    </>
  );
}
