import { useModeration } from '@libs/moderation-client/moderation-context';
import { displayNotification } from '@libs/notifications-client/notification-display';
import type { Notification } from '@libs/notifications-shared/notification';
import type { NotificationCardActions } from '@libs/notifications-shared/notification-action';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client/solid';
import type { SoundId } from '@pkgs/sounds-shared/sound-id';
import { isSoundId, Sounds } from '@pkgs/sounds-shared/sound-id';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { Button } from '@pkgs/ui-root-client/button';
import { ModalBody, ModalFooter } from '@pkgs/ui-root-client/modal-parts';
import type { MutationStateTransition } from '@pkgs/ui-root-client/mutation-lifecycle';
import { useConfirmNavigation } from '@pkgs/ui-root-client/pending-navigation';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import type { JSX } from 'solid-js';
import { createMemo, Show, untrack } from 'solid-js';

import { FriendProfileAvatar } from './friend-profile-avatar';
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

function usernameFrom(interaction: Notification): string {
  return typeof interaction.payload['fromUsername'] === 'string'
    ? interaction.payload['fromUsername']
    : '';
}

function useDecisionSounds(
  successSound: () => SoundId | undefined
): (transition: MutationStateTransition) => void {
  const engine = useOptionalSoundEngine();
  return (transition) => {
    const current = engine?.();
    if (current === undefined) return;
    if (transition.to === 'success') {
      current.play(successSound() ?? Sounds.feedback.success);
    } else if (transition.to === 'error') {
      current.play(Sounds.feedback.error);
    }
  };
}

function AcceptButton(props: {
  interaction: Notification;
  actions: NotificationCardActions;
  onDone: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const accept = createMemo(() => findAction(props.interaction, 'accept'));
  const successSound = (): SoundId | undefined => {
    const action = accept();
    return action?.soundKey !== undefined && isSoundId(action.soundKey)
      ? action.soundKey
      : undefined;
  };
  const onPhaseChange = useDecisionSounds(successSound);
  const username = createMemo(() => usernameFrom(props.interaction));
  const mutation = useMutationButton({
    operation: async () => {
      await props.actions.performAction(props.interaction.id, 'accept');
      props.onDone();
    },
    labels: {
      idle: accept()?.label ?? t`Accept`,
      loading: t`Accepting…`,
      success: t`Accepted`,
      error: t`Couldn't accept`,
    },
    successHoldMs: 0,
    onPhaseChange,
  });
  return (
    <Button
      {...mutation.buttonProps}
      errorLabel={mutation.error()?.message ?? t`Couldn't accept`}
      intent="primary"
      size="md"
      {...(username().length > 0
        ? {
            dataSet: {
              testid: Handles.notificationsFriendRequestAccept(username()),
            },
          }
        : {})}
    />
  );
}

function DeclineButton(props: {
  interaction: Notification;
  actions: NotificationCardActions;
  onDone: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const decline = createMemo(() => findAction(props.interaction, 'decline'));
  const username = createMemo(() => usernameFrom(props.interaction));
  const onPhaseChange = useDecisionSounds(() => undefined);
  const mutation = useMutationButton({
    operation: async () => {
      await props.actions.performAction(props.interaction.id, 'decline');
      props.onDone();
    },
    labels: {
      idle: decline()?.label ?? t`Decline`,
      loading: t`Declining…`,
      success: t`Declined`,
      error: t`Couldn't decline`,
    },
    successHoldMs: 0,
    onPhaseChange,
  });
  return (
    <Button
      {...mutation.buttonProps}
      intent="neutral"
      variant="ghost"
      size="md"
      {...(username().length > 0
        ? {
            dataSet: {
              testid: Handles.notificationsFriendRequestDecline(username()),
            },
          }
        : {})}
    />
  );
}

export type FriendRequestDecisionModalProps = {
  readonly visible: boolean;
  readonly interaction: Notification;
  readonly actions: NotificationCardActions;
  readonly onClose: () => void;
};

export function FriendRequestDecisionModal(
  props: FriendRequestDecisionModalProps
): JSX.Element {
  const router = useRouter();
  const confirmNavigation = useConfirmNavigation();
  const moderation = useModeration();
  const profile = createMemo(() =>
    profileFromFriendRequestNotification(props.interaction)
  );
  const title = createMemo(
    () => displayNotification(moderation(), props.interaction).title
  );

  const onViewProfile = () =>
    confirmNavigation(() =>
      untrack(() => {
        props.onClose();
        if (props.interaction.deepLink === undefined) return;
        router.push({
          pathname: props.interaction.deepLink.path,
          ...(props.interaction.deepLink.params !== undefined
            ? {
                params: props.interaction.deepLink.params as Record<
                  string,
                  string | undefined
                >,
              }
            : {}),
        });
      })
    );

  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={props.onClose}
      title={<Trans>Friend request</Trans>}
      presentation="modal"
      size="medium"
    >
      <ModalBody>
        <div class="box items-center gap-2">
          <Show when={profile().userId.length > 0}>
            <FriendProfileAvatar profile={profile()} size={64} />
          </Show>
          <p class="text textBodyBold text-center">{title()}</p>
        </div>
      </ModalBody>
      <ModalFooter>
        <AcceptButton
          interaction={props.interaction}
          actions={props.actions}
          onDone={props.onClose}
        />
        <DeclineButton
          interaction={props.interaction}
          actions={props.actions}
          onDone={props.onClose}
        />
        <Button
          title={<Trans>View profile</Trans>}
          intent="neutral"
          variant="ghost"
          size="md"
          onClick={onViewProfile}
          {...(profile().username.length > 0
            ? {
                dataSet: {
                  testid: Handles.notificationsFriendRequestViewProfile(
                    profile().username
                  ),
                },
              }
            : {})}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
