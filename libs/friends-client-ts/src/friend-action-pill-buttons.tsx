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

export function ConfirmDeletePills(props: {
  /** A row's trailing pair: small pills that keep to their labels. */
  compact?: boolean;
  onConfirm: () => Promise<void>;
  onDelete: () => Promise<void>;
  confirmTestID?: string;
  deleteTestID?: string;
}): JSX.Element {
  const { t } = useLingui();
  const confirm = useMutationButton({
    operation: () => props.onConfirm(),
    labels: {
      idle: <Trans>Confirm</Trans>,
      loading: t`Confirming…`,
      success: t`Confirmed`,
      error: t`Couldn't confirm`,
    },
    successHoldMs: 0,
  });
  const del = useMutationButton({
    operation: () => props.onDelete(),
    labels: {
      idle: <Trans>Delete</Trans>,
      loading: t`Deleting…`,
      success: t`Deleted`,
      error: t`Couldn't delete`,
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
          {...confirm.buttonProps}
          {...(props.confirmTestID !== undefined
            ? { dataSet: { testid: props.confirmTestID } }
            : {})}
        />
      </StackVertical>
      <StackVertical grow={!compact()}>
        <Button
          variant="outline"
          intent={compact() ? 'neutral' : undefined}
          size={compact() ? 'sm' : undefined}
          {...del.buttonProps}
          {...(props.deleteTestID !== undefined
            ? { dataSet: { testid: props.deleteTestID } }
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
  /** A row's trailing control: the small secondary pill. */
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
  return (
    <Button
      variant={props.compact === true ? 'outline' : (props.variant ?? 'solid')}
      intent={props.compact === true ? 'neutral' : undefined}
      size={props.compact === true ? 'sm' : undefined}
      icon={props.icon}
      {...mutation.buttonProps}
      {...(props.testID !== undefined
        ? { dataSet: { testid: props.testID } }
        : {})}
    />
  );
}
