import { Trans, useLingui } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client/solid';
import type { SoundId } from '@pkgs/sounds-shared/sound-id';
import { Sounds } from '@pkgs/sounds-shared/sound-id';
import { Button } from '@pkgs/ui-client/button';
import type { MutationStateTransition } from '@pkgs/ui-client/mutation-lifecycle';
import { useMutationButton } from '@pkgs/ui-client/use-mutation-button';
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
  return (
    <div class="box flex-row gap-2 self-stretch">
      <div class="box flex-1">
        <Button
          variant="solid"
          {...confirm.buttonProps}
          {...(props.confirmTestID !== undefined
            ? { dataSet: { testid: props.confirmTestID } }
            : {})}
        />
      </div>
      <div class="box flex-1">
        <Button
          variant="outline"
          {...del.buttonProps}
          {...(props.deleteTestID !== undefined
            ? { dataSet: { testid: props.deleteTestID } }
            : {})}
        />
      </div>
    </div>
  );
}

export function SingleActionPill(props: {
  operation: () => Promise<void>;
  idle: JSX.Element;
  loading: string;
  success: string;
  error: string;
  variant?: 'solid' | 'outline';
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
      variant={props.variant ?? 'solid'}
      {...mutation.buttonProps}
      {...(props.testID !== undefined
        ? { dataSet: { testid: props.testID } }
        : {})}
    />
  );
}
