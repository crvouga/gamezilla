import { Handles } from '@libs/dst-handles';
import type {
  Notification,
  NotificationCardActions,
} from '@libs/notifications/public';
import { Trans, useLingui } from '@lingui/react/macro';
import { isSoundId } from '@pkgs/sounds';
import {
  Box,
  Button,
  ModalBody,
  ModalFooter,
  ResponsiveSurface,
  Text,
  useMutationButton,
  useRouter,
} from '@pkgs/ui';
import { type ReactNode, useCallback, useMemo } from 'react';

import { FriendProfileAvatar } from '../../public/friend-profile-avatar';
import { profileFromFriendRequestNotification } from './friend-request-notification-profile';

function findAction(
  interaction: Notification,
  id: string
): { id: string; label: string; soundKey?: string } | undefined {
  const action = interaction.actions.find((item) => item.id === id);
  if (action === undefined) return undefined;
  return {
    id: action.id,
    label: action.label,
    ...(action.soundKey !== undefined ? { soundKey: action.soundKey } : {}),
  };
}

function AcceptButton({
  interaction,
  actions,
  onDone,
}: {
  interaction: Notification;
  actions: NotificationCardActions;
  onDone: () => void;
}): ReactNode {
  const { t } = useLingui();
  const accept = findAction(interaction, 'accept');
  const successSound =
    accept?.soundKey !== undefined && isSoundId(accept.soundKey)
      ? accept.soundKey
      : undefined;
  const username =
    typeof interaction.payload['fromUsername'] === 'string'
      ? interaction.payload['fromUsername']
      : '';
  const mutation = useMutationButton({
    operation: useCallback(async () => {
      await actions.performAction(interaction.id, 'accept');
      onDone();
    }, [actions, interaction.id, onDone]),
    labels: {
      idle: accept?.label ?? t`Accept`,
      loading: t`Accepting…`,
      success: t`Accepted`,
      error: t`Couldn't accept`,
    },
    successHoldMs: 0,
    ...(successSound !== undefined
      ? { sounds: { success: successSound, error: 'feedback.error' as const } }
      : { sounds: { error: 'feedback.error' as const } }),
  });
  return (
    <Button
      {...mutation.buttonProps}
      intent="primary"
      size="md"
      {...(username.length > 0
        ? { testID: Handles.notificationsFriendRequestAccept(username) }
        : {})}
    />
  );
}

function DeclineButton({
  interaction,
  actions,
  onDone,
}: {
  interaction: Notification;
  actions: NotificationCardActions;
  onDone: () => void;
}): ReactNode {
  const { t } = useLingui();
  const decline = findAction(interaction, 'decline');
  const mutation = useMutationButton({
    operation: useCallback(async () => {
      await actions.performAction(interaction.id, 'decline');
      onDone();
    }, [actions, interaction.id, onDone]),
    labels: {
      idle: decline?.label ?? t`Decline`,
      loading: t`Declining…`,
      success: t`Declined`,
      error: t`Couldn't decline`,
    },
    successHoldMs: 0,
    sounds: { error: 'feedback.error' },
  });
  return (
    <Button
      {...mutation.buttonProps}
      intent="neutral"
      variant="ghost"
      size="md"
    />
  );
}

export type FriendRequestDecisionModalProps = {
  readonly visible: boolean;
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly onClose: () => void;
};

export function FriendRequestDecisionModal({
  visible,
  interaction,
  actions,
  onClose,
}: FriendRequestDecisionModalProps): ReactNode {
  const router = useRouter();
  const profile = useMemo(
    () => profileFromFriendRequestNotification(interaction),
    [interaction]
  );

  const onViewProfile = useCallback(() => {
    onClose();
    if (interaction.deepLink === undefined) return;
    router.push({
      pathname: interaction.deepLink.path as never,
      params: interaction.deepLink.params as never,
    });
  }, [interaction.deepLink, onClose, router]);

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>Friend request</Trans>}
      presentation="modal"
      size="medium"
    >
      <ModalBody>
        <Box sx={{ alignItems: 'center', gap: 2 }}>
          {profile.userId.length > 0 ? (
            <FriendProfileAvatar profile={profile} size={64} />
          ) : null}
          <Text
            variant="bodyBold"
            label={interaction.title}
            sx={{ textAlign: 'center' }}
          />
        </Box>
      </ModalBody>
      <ModalFooter>
        <AcceptButton
          interaction={interaction}
          actions={actions}
          onDone={onClose}
        />
        <DeclineButton
          interaction={interaction}
          actions={actions}
          onDone={onClose}
        />
        <Button
          title={<Trans>View profile</Trans>}
          intent="neutral"
          variant="ghost"
          size="md"
          onPress={onViewProfile}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
