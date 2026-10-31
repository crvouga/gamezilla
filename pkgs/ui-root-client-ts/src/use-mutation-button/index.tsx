/**
 * `useMutationButton` -- drive a {@link Button}'s `feedback` lifecycle from an
 * async operation. The button reads the same `idle -> loading -> success /
 * error` phases as `MutationModal`, but inline: success briefly flashes a
 * check before `onSuccess` (or an auto-reset), and errors stay until retried.
 *
 * Use this for lightweight, no-confirm mutations where a full modal is
 * overkill -- joining a space, creating a space, saving a form field.
 *
 * Returned `buttonProps` / `fabProps` are reactive (getter-backed): spread
 * them straight onto the component (`<Button {...join.buttonProps} />`).
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

import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { type Accessor, createEffect, type JSX, onCleanup } from 'solid-js';
import type { ButtonProps } from '../button/index';
import type { ButtonFeedback } from '../button-face';
import type { MutationStateTransition } from '../mutation-lifecycle';
import { useMutationLifecycle } from '../mutation-lifecycle';
import { MutationOutcomeUnknownError } from '../mutation-outcome-unknown-error';
import { useMutationSuccessHoldMs } from '../mutation-success-hold/index';

export type MutationButtonLabels = {
  /** Resting label (the action prompt). */
  idle: JSX.Element;
  loading?: JSX.Element | undefined;
  success?: JSX.Element | undefined;
  error?: JSX.Element | undefined;
};

export type UseMutationButtonParams = {
  /** The mutation to run on click. */
  operation: () => Promise<void>;
  labels: MutationButtonLabels;
  /** Runs after the success face has been shown for `successHoldMs`. */
  onSuccess?: (() => void) | undefined;
  /** Side-effect notified on failure (e.g. structured logging). */
  onError?: ((error: Error) => void) | undefined;
  /** Side-effect notified on every phase change (sounds, analytics). */
  onPhaseChange?: ((transition: MutationStateTransition) => void) | undefined;
  /**
   * How long the success face shows before `onSuccess` runs and the button
   * resets to idle. Defaults to the env-provided hold, then 900ms.
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
  | 'onClick'
  | 'onRetry'
  | 'disabled'
>;

/** Props to spread onto a `FloatingActionButton`. */
export type MutationFabProps = {
  feedback: ButtonFeedback;
  onClick: () => void;
  onRetry: () => void;
  disabled: boolean;
  'aria-label': string;
  label: JSX.Element;
  loadingLabel: JSX.Element | undefined;
  successLabel: JSX.Element | undefined;
  errorLabel: JSX.Element | undefined;
};

export type UseMutationButtonResult = {
  feedback: Accessor<ButtonFeedback>;
  /** Populated only while `feedback() === 'error'`. */
  error: Accessor<Error | null>;
  /** Run the operation; never rejects (failures surface via `feedback`). */
  run: () => Promise<void>;
  /** Return to idle and drop any captured error. */
  reset: () => void;
  buttonProps: MutationButtonProps;
  fabProps: MutationFabProps;
};

export const DEFAULT_SUCCESS_HOLD_MS = 900;

function nodeToAriaLabel(value: JSX.Element): string {
  if (typeof value === 'string') return value;
  if (value instanceof Element) return value.textContent;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function ariaLabelForPhase(
  phase: ButtonFeedback,
  labels: MutationButtonLabels
): string {
  switch (phase) {
    case 'loading':
      return nodeToAriaLabel(labels.loading ?? labels.idle);
    case 'success':
      return nodeToAriaLabel(labels.success ?? labels.idle);
    case 'error':
      return nodeToAriaLabel(labels.error ?? labels.idle);
    default:
      return nodeToAriaLabel(labels.idle);
  }
}

export function useMutationButton(
  params: UseMutationButtonParams
): UseMutationButtonResult {
  const { t } = useLingui();
  const envHoldMs = useMutationSuccessHoldMs();
  const holdMs = (): number =>
    params.successHoldMs ?? envHoldMs ?? DEFAULT_SUCCESS_HOLD_MS;
  const lifecycle = useMutationLifecycle({
    operation: () => params.operation(),
    onError: (error) => params.onError?.(error),
    onPhaseChange: (transition) => params.onPhaseChange?.(transition),
  });
  const errorLabel = (): JSX.Element =>
    lifecycle.error() instanceof MutationOutcomeUnknownError
      ? t`Not confirmed. Check again`
      : params.labels.error;
  const timers = useTimers();

  createEffect(() => {
    if (lifecycle.phase() !== 'success') return;
    const id = timers.setTimeout(() => {
      try {
        params.onSuccess?.();
      } finally {
        lifecycle.reset();
      }
    }, holdMs());
    onCleanup(() => timers.clearTimeout(id));
  });

  const click = (): void => {
    void lifecycle.run();
  };
  const disabled = (): boolean => params.disabled ?? false;

  const buttonProps: MutationButtonProps = {
    get title() {
      return params.labels.idle;
    },
    get feedback() {
      return lifecycle.phase();
    },
    get loadingLabel() {
      return params.labels.loading;
    },
    get successLabel() {
      return params.labels.success;
    },
    get errorLabel() {
      return errorLabel();
    },
    onClick: click,
    onRetry: click,
    get disabled() {
      return disabled();
    },
  };

  const fabProps: MutationFabProps = {
    get feedback() {
      return lifecycle.phase();
    },
    get label() {
      return params.labels.idle;
    },
    get loadingLabel() {
      return params.labels.loading;
    },
    get successLabel() {
      return params.labels.success;
    },
    get errorLabel() {
      return errorLabel();
    },
    onClick: click,
    onRetry: click,
    get disabled() {
      return disabled();
    },
    get 'aria-label'() {
      return ariaLabelForPhase(lifecycle.phase(), {
        ...params.labels,
        error: errorLabel(),
      });
    },
  };

  return {
    feedback: lifecycle.phase,
    error: lifecycle.error,
    run: lifecycle.run,
    reset: lifecycle.reset,
    buttonProps,
    fabProps,
  };
}
