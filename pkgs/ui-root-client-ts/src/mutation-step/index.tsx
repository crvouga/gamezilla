/** @jsxImportSource @solidjs/web */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Match, Switch } from 'solid-js';
import type {
  MutationPhase,
  MutationStateTransition,
} from '../mutation-lifecycle';
import { useMutationLifecycle } from '../mutation-lifecycle';
import type {
  MutationModalIds,
  MutationModalLabels,
} from '../mutation-modal-parts/index';
import {
  MutationError,
  MutationIdle,
  MutationLoading,
  MutationSuccess,
} from '../mutation-modal-parts/index';

export type MutationStepProps = {
  /** Closes the step (Cancel, Close while pending, Done after success). */
  onClose: () => void;
  title: JSX.Element;
  /** Plain confirmation copy. Ignored when `children` is provided. */
  message?: JSX.Element | undefined;
  /**
   * What the confirm is about (a person's full handle), on its own line
   * above `message`; keeps the title short. Ignored with `children`.
   */
  subject?: JSX.Element | undefined;
  /** Custom idle-phase body (e.g. form fields). Takes precedence over `message`. */
  children?: JSX.Element | undefined;
  /** The mutation to run on submit. */
  operation: () => Promise<void>;
  submitLabel: JSX.Element;
  cancelLabel?: JSX.Element | undefined;
  /** Submit button color role. Defaults to `'default'`. */
  variant?: 'default' | 'destructive' | undefined;
  /** Disable the submit button (e.g. failed form validation). */
  submitDisabled?: boolean | undefined;
  /** Caption under the spinner while running. */
  loadingLabel?: JSX.Element | undefined;
  successTitle: JSX.Element;
  successBody?: JSX.Element | undefined;
  /** Defaults to a generic localized failure title. */
  errorTitle?: JSX.Element | undefined;
  /** Success dismiss button label. Defaults to "Done". */
  dismissLabel?: JSX.Element | undefined;
  /** Error retry button label. Defaults to "Try again". */
  retryLabel?: JSX.Element | undefined;
  /** Notified on failure (e.g. logging). */
  onError?: ((error: Error) => void) | undefined;
  /** Side-effect on every phase change (sounds, analytics). */
  onPhaseChange?: ((transition: MutationStateTransition) => void) | undefined;
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: (() => void) | undefined;
  /** `data-*` identifiers for the confirm/submit button, including retry after failure. */
  submitDataSet?: ComponentDataSet | undefined;
  /** `data-*` identifiers for the idle-phase cancel button. */
  cancelDataSet?: ComponentDataSet | undefined;
  /** `data-*` identifiers for the success-state block. */
  successDataSet?: ComponentDataSet | undefined;
  /** `data-*` identifiers for the success-phase dismiss button. */
  dismissDataSet?: ComponentDataSet | undefined;
};

/** What a surface hosting a {@link useMutationStep} reads from it. */
export type MutationStep = {
  readonly phase: () => MutationPhase;
  /** The question, then the outcome once it is answered ("Space ended"). */
  readonly title: () => JSX.Element;
  /** The surface's own close: dismisses a success, else closes. */
  readonly close: () => void;
  /** Back to the confirm body (a reopened modal). */
  readonly reset: () => void;
  /**
   * The phase body: confirm or form, then loading / success / error. A
   * component, rendered inside the hosting surface so it reads that
   * surface's context (edge padding, pending-operation scope).
   */
  readonly Body: () => JSX.Element;
};

/** Closing a pending operation does not pretend that its request was cancelled. */
export function resolveMutationSurfaceClose(args: {
  phase: MutationPhase;
  onClose: () => void;
  dismissSuccess: () => void;
}): void {
  if (args.phase === 'success') {
    args.dismissSuccess();
    return;
  }
  args.onClose();
}

/** Getter-backed so phase bodies read the latest labels reactively. */
function stepLabels(props: MutationStepProps): MutationModalLabels {
  return {
    get submitLabel() {
      return props.submitLabel;
    },
    get cancelLabel() {
      return props.cancelLabel;
    },
    get loadingLabel() {
      return props.loadingLabel;
    },
    get successTitle() {
      return props.successTitle;
    },
    get successBody() {
      return props.successBody;
    },
    get errorTitle() {
      return props.errorTitle;
    },
    get dismissLabel() {
      return props.dismissLabel;
    },
    get retryLabel() {
      return props.retryLabel;
    },
  };
}

function stepIds(props: MutationStepProps): MutationModalIds {
  return {
    get submitDataSet() {
      return props.submitDataSet;
    },
    get cancelDataSet() {
      return props.cancelDataSet;
    },
    get successDataSet() {
      return props.successDataSet;
    },
    get dismissDataSet() {
      return props.dismissDataSet;
    },
  };
}

function MutationStepBody(props: {
  step: MutationStepProps;
  labels: MutationModalLabels;
  ids: MutationModalIds;
  phase: MutationPhase;
  error: Error | null;
  run: () => void;
  dismissSuccess: () => void;
}): JSX.Element {
  const close = (): void => props.step.onClose();
  return (
    <div
      class="box"
      data-component="MutationStateTransition"
      data-phase={props.phase}
    >
      <Switch
        fallback={
          <MutationIdle
            labels={props.labels}
            ids={props.ids}
            message={props.step.message}
            subject={props.step.subject}
            destructive={props.step.variant === 'destructive'}
            submitDisabled={props.step.submitDisabled ?? false}
            onRun={props.run}
            onClose={close}
          >
            {props.step.children}
          </MutationIdle>
        }
      >
        <Match when={props.phase === 'loading'}>
          <MutationLoading labels={props.labels} onClose={close} />
        </Match>
        <Match when={props.phase === 'success'}>
          <MutationSuccess
            labels={props.labels}
            ids={props.ids}
            onDismiss={props.dismissSuccess}
          />
        </Match>
        <Match when={props.phase === 'error'}>
          <MutationError
            ids={props.ids}
            labels={props.labels}
            error={props.error}
            form={props.step.children}
            onRetry={props.run}
            onClose={close}
          />
        </Match>
      </Switch>
    </div>
  );
}

/**
 * `useMutationStep` -- one mutation's whole lifecycle as a step a surface
 * hosts: confirm (or form) -> loading -> success / error, in place. It is
 * the body of `MutationModal`, and a surface that asks in its own panel
 * (Share's Remove person) swaps its title and content to it instead of
 * stacking a second dialog.
 */
export function useMutationStep(props: MutationStepProps): MutationStep {
  const lifecycle = useMutationLifecycle({
    operation: () => props.operation(),
    onError: (error) => props.onError?.(error),
    onPhaseChange: (transition) => props.onPhaseChange?.(transition),
  });
  const dismissSuccess = (): void => {
    props.onClose();
    props.onSuccess?.();
  };
  const labels = stepLabels(props);
  const ids = stepIds(props);
  const Body = (): JSX.Element => (
    <MutationStepBody
      step={props}
      labels={labels}
      ids={ids}
      phase={lifecycle.phase()}
      error={lifecycle.error()}
      run={() => void lifecycle.run()}
      dismissSuccess={dismissSuccess}
    />
  );
  return {
    phase: lifecycle.phase,
    title: () =>
      lifecycle.phase() === 'success' && props.successBody !== undefined
        ? props.successTitle
        : props.title,
    close: () =>
      resolveMutationSurfaceClose({
        phase: lifecycle.phase(),
        onClose: props.onClose,
        dismissSuccess,
      }),
    reset: () => lifecycle.reset(),
    Body,
  };
}
