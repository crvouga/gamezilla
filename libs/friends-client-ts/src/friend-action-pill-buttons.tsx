import { Trans, useLingui } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import type { SoundId } from '@pkgs/sounds-shared-ts/sound-id';
import { Sounds } from '@pkgs/sounds-shared-ts/sound-id';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import type { MutationStateTransition } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from 'solid-js';

function usePillSounds(
  sounds: () => { success?: SoundId; error?: SoundId }
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

/**
 * A request's answer: Accept / Decline, the same two words the inbox and the
 * request modal use, so one decision reads alike everywhere.
 */
export function AcceptDeclinePills(props: {
  /** A row's trailing pair: small pills that keep to their labels. */
  compact?: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  acceptTestID?: string;
  declineTestID?: string;
}): JSX.Element {
  const { t } = useLingui();
  const accept = useMutationButton({
    operation: () => props.onAccept(),
    labels: {
      idle: <Trans>Accept</Trans>,
      loading: t`Accepting…`,
      success: t`Accepted`,
      error: t`Couldn't accept`,
    },
    successHoldMs: 0,
  });
  const decline = useMutationButton({
    operation: () => props.onDecline(),
    labels: {
      idle: <Trans>Decline</Trans>,
      loading: t`Declining…`,
      success: t`Declined`,
      error: t`Couldn't decline`,
    },
    successHoldMs: 0,
  });
  const compact = (): boolean => props.compact === true;
  return (
    <StackHorizontal gap="sm" self={compact() ? undefined : 'stretch'}>
      <StackVertical grow={!compact()}>
        <Button
          variant="solid"
          size={compact() ? 'sm' : undefined}
          {...accept.buttonProps}
          {...(props.acceptTestID !== undefined
            ? { dataSet: { testid: props.acceptTestID } }
            : {})}
        />
      </StackVertical>
      <StackVertical grow={!compact()}>
        <Button
          variant="outline"
          intent={compact() ? 'neutral' : undefined}
          size={compact() ? 'sm' : undefined}
          {...decline.buttonProps}
          {...(props.declineTestID !== undefined
            ? { dataSet: { testid: props.declineTestID } }
            : {})}
        />
      </StackVertical>
    </StackHorizontal>
  );
}

export function SingleActionPill(props: {
  operation: () => Promise<void>;
  idle: JSX.Element;
  loading: string;
  success: string;
  error: string;
  variant?: 'solid' | 'outline' | 'ghost';
  /**
   * A row's trailing control: the small outlined pill every row's single
   * action shares, whatever it does, so the rows end alike.
   */
  compact?: boolean;
  icon?: IconComponent;
  disabled?: boolean;
  sounds?: { success?: SoundId; error?: SoundId };
  testID?: string;
}): JSX.Element {
  const onPhaseChange = usePillSounds(() => props.sounds ?? {});
  const labels = {
    get idle() {
      return props.idle;
    },
    get loading() {
      return props.loading;
    },
    get success() {
      return props.success;
    },
    get error() {
      return props.error;
    },
  };
  const mutation = useMutationButton({
    operation: () => props.operation(),
    labels,
    successHoldMs: 0,
    get disabled() {
      return props.disabled ?? false;
    },
    onPhaseChange,
  });
  const small = (): boolean => props.compact === true;
  const variant = (): 'solid' | 'outline' | 'ghost' =>
    small() ? 'outline' : (props.variant ?? 'solid');
  return (
    <Button
      variant={variant()}
      intent={small() ? 'neutral' : undefined}
      size={small() ? 'sm' : undefined}
      icon={props.icon}
      {...mutation.buttonProps}
      {...(props.testID !== undefined
        ? { dataSet: { testid: props.testID } }
        : {})}
    />
  );
}
