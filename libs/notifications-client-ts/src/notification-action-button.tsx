/** @jsxImportSource solid-js */

import type { Notification } from '@libs/notifications-shared-ts/notification';
import type {
  NotificationAction,
  NotificationCardActions,
} from '@libs/notifications-shared-ts/notification-action';
import { useLingui } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import type { SoundId } from '@pkgs/sounds-shared-ts/sound-id';
import { isSoundId, Sounds } from '@pkgs/sounds-shared-ts/sound-id';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { MutationStateTransition } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from 'solid-js';

/** A card's one main answer (Join, Accept) or one of its other choices. */
export type NotificationActionEmphasis = 'primary' | 'secondary';

/** The card's main answer: its first action that does not take something away. */
export function primaryNotificationActionId(
  actions: readonly NotificationAction[]
): string | undefined {
  return actions.find((action) => action.destructive !== true)?.id;
}

type MutationSoundIds = {
  readonly success?: SoundId | undefined;
  readonly error?: SoundId | undefined;
};

function useMutationPhaseSounds(
  sounds: () => MutationSoundIds
): (transition: MutationStateTransition) => void {
  const engine = useOptionalSoundEngine();
  return (transition) => {
    const current = engine?.();
    if (current === undefined) return;
    if (transition.to === 'success') {
      current.play(sounds().success ?? Sounds.feedback.success);
    } else if (transition.to === 'error') {
      current.play(sounds().error ?? Sounds.feedback.error);
    }
  };
}

export type NotificationActionButtonProps = {
  readonly interaction: Notification;
  readonly action: NotificationAction;
  readonly actions: NotificationCardActions;
  readonly emphasis: NotificationActionEmphasis;
  readonly testID?: string | undefined;
};

/**
 * One published answer on an inbox card: a small pill that shows its own
 * progress, success and retryable failure. The main answer is the solid
 * primary pill; every other choice is a neutral outline beside it.
 */
export function NotificationActionButton(
  props: NotificationActionButtonProps
): JSX.Element {
  const { t } = useLingui();
  const successSound = (): SoundId | undefined => {
    const soundKey = props.action.soundKey;
    return soundKey !== undefined && isSoundId(soundKey) ? soundKey : undefined;
  };
  const onPhaseChange = useMutationPhaseSounds(() => ({
    ...(successSound() !== undefined ? { success: successSound() } : {}),
    error: Sounds.feedback.error,
  }));
  const mutation = useMutationButton({
    operation: () =>
      props.actions.performAction(props.interaction.id, props.action.id),
    labels: {
      get idle() {
        return props.action.label;
      },
      get loading() {
        return t`Working…`;
      },
      get success() {
        return t`Done`;
      },
      get error() {
        return t`Failed`;
      },
    },
    successHoldMs: 0,
    get disabled() {
      return props.action.disabled === true;
    },
    onPhaseChange,
  });

  return (
    <Button
      {...mutation.buttonProps}
      variant={props.emphasis === 'primary' ? 'solid' : 'outline'}
      size="sm"
      intent={props.emphasis === 'primary' ? 'primary' : 'neutral'}
      dataSet={
        props.testID !== undefined ? { testid: props.testID } : undefined
      }
    />
  );
}
