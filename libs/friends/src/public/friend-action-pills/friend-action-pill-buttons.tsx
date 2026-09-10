import { Trans, useLingui } from '@lingui/solid/macro';
import { type SoundId, Sounds } from '@pkgs/sounds';
import { useOptionalSoundEngine } from '@pkgs/sounds/solid';
import {
  Button,
  type MutationStateTransition,
  useMutationButton,
} from '@pkgs/ui';
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

export function ConfirmDeletePills({
  onConfirm,
  onDelete,
  confirmTestID,
}: {
  onConfirm: () => Promise<void>;
  onDelete: () => Promise<void>;
  confirmTestID?: string;
}): JSX.Element {
  const { t } = useLingui();
  const confirm = useMutationButton({
    operation: onConfirm,
    labels: {
      idle: <Trans>Confirm</Trans>,
      loading: t`Confirming…`,
      success: t`Confirmed`,
      error: t`Couldn't confirm`,
    },
    successHoldMs: 0,
  });
  const del = useMutationButton({
    operation: onDelete,
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
          {...(confirmTestID !== undefined
            ? { dataSet: { testid: confirmTestID } }
            : {})}
        />
      </div>
      <div class="box flex-1">
        <Button variant="outline" {...del.buttonProps} />
      </div>
    </div>
  );
}

export function SingleActionPill({
  operation,
  idle,
  loading,
  success,
  error,
  variant = 'solid',
  disabled = false,
  sounds,
  testID,
}: {
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
  const onPhaseChange = usePillSounds(() => sounds ?? {});
  const mutation = useMutationButton({
    operation,
    labels: { idle, loading, success, error },
    successHoldMs: 0,
    disabled,
    onPhaseChange,
  });
  return (
    <Button
      variant={variant}
      {...mutation.buttonProps}
      {...(testID !== undefined ? { dataSet: { testid: testID } } : {})}
    />
  );
}
