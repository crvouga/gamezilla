/**
 * `useMutationButton` -- drive a {@link Button}'s `feedback` lifecycle from an
 * async operation. The button reads the same `idle -> loading -> success /
 * error` phases as {@link MutationModal}, but inline: success briefly flashes a
 * check before `onSuccess` (or an auto-reset), and errors stay until retried.
 *
 * Use this for lightweight, no-confirm mutations where a full modal is
 * overkill -- joining a space, creating a space, saving a form field.
 *
 * @example
 * ```tsx
 * const join = useMutationButton({
 *   operation: () => joinSpace(spaceId),
 *   labels: {
 *     idle: t`Join space`,
 *     loading: t`Joining…`,
 *     success: t`Joined`,
 *     error: t`Couldn't join`,
 *   },
 * });
 * return <Button {...join.buttonProps} />;
 * ```
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useMutationLifecycle } from '../mutation-modal/use-mutation-lifecycle';
import type { ButtonFeedback, ButtonProps } from './button';

export type MutationButtonLabels = {
  /** Resting label (the action prompt). */
  idle: ReactNode;
  loading?: ReactNode | undefined;
  success?: ReactNode | undefined;
  error?: ReactNode | undefined;
};

export type UseMutationButtonParams = {
  /** The mutation to run on press. Wrap in `useCallback` for stability. */
  operation: () => Promise<void>;
  labels: MutationButtonLabels;
  /** Runs after the success face has been shown for `successHoldMs`. */
  onSuccess?: (() => void) | undefined;
  /** Side-effect notified on failure (e.g. structured logging). */
  onError?: ((error: Error) => void) | undefined;
  /**
   * How long the success face shows before `onSuccess` runs (or, if no
   * `onSuccess`, before the button resets to idle). Defaults to 900ms.
   */
  successHoldMs?: number | undefined;
  /** Disable the button in the idle phase (e.g. failed validation). */
  disabled?: boolean | undefined;
};

/** Props to spread onto a {@link Button}. */
export type MutationButtonProps = Pick<
  ButtonProps,
  | 'title'
  | 'feedback'
  | 'loadingLabel'
  | 'successLabel'
  | 'errorLabel'
  | 'onPress'
  | 'onRetry'
  | 'disabled'
>;

export type UseMutationButtonResult = {
  feedback: ButtonFeedback;
  /** Populated only while `feedback === 'error'`. */
  error: Error | null;
  /** Run the operation; never rejects (failures surface via `feedback`). */
  run: () => Promise<void>;
  /** Return to idle and drop any captured error. */
  reset: () => void;
  buttonProps: MutationButtonProps;
};

const DEFAULT_SUCCESS_HOLD_MS = 900;

export function useMutationButton({
  operation,
  labels,
  onSuccess,
  onError,
  successHoldMs = DEFAULT_SUCCESS_HOLD_MS,
  disabled = false,
}: UseMutationButtonParams): UseMutationButtonResult {
  const { phase, error, run, reset } = useMutationLifecycle({
    operation,
    onError,
  });

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const resetRef = useRef(reset);
  resetRef.current = reset;

  useEffect(() => {
    if (phase !== 'success') return undefined;
    const id = setTimeout(() => {
      const cb = onSuccessRef.current;
      if (cb !== undefined) cb();
      else resetRef.current();
    }, successHoldMs);
    return () => clearTimeout(id);
  }, [phase, successHoldMs]);

  const buttonProps = useMemo<MutationButtonProps>(
    () => ({
      title: labels.idle,
      feedback: phase,
      loadingLabel: labels.loading,
      successLabel: labels.success,
      errorLabel: labels.error,
      onPress: () => void run(),
      onRetry: () => void run(),
      disabled,
    }),
    [
      labels.idle,
      labels.loading,
      labels.success,
      labels.error,
      phase,
      run,
      disabled,
    ]
  );

  return { feedback: phase, error, run, reset, buttonProps };
}
