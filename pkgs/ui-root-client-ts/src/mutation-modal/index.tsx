/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { createEffect, type JSX, Match, on, Switch } from 'solid-js';
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
import { ResponsiveSurface } from '../responsive-surface/index';

export type MutationModalProps = {
  visible: boolean;
  onClose: () => void;
  title: JSX.Element;
  /** Plain confirmation copy. Ignored when `children` is provided. */
  message?: JSX.Element | undefined;
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
  /** Stable surface-stack id; keeps this dialog above remounting underlays. */
  stackId?: string | undefined;
  /** `data-*` identifiers for the confirm/submit button, including retry after failure. */
  submitDataSet?: ComponentDataSet | undefined;
  /** `data-*` identifiers for the idle-phase cancel button. */
  cancelDataSet?: ComponentDataSet | undefined;
  /** `data-*` identifiers for the success-state block. */
  successDataSet?: ComponentDataSet | undefined;
  /** `data-*` identifiers for the success-phase dismiss button. */
  dismissDataSet?: ComponentDataSet | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
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
function mutationModalLabels(props: MutationModalProps): MutationModalLabels {
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

function mutationModalIds(props: MutationModalProps): MutationModalIds {
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

/**
 * `MutationModal` -- one dialog for the whole mutation lifecycle.
 *
 * Always a centered modal via {@link ResponsiveSurface} `presentation="modal"`
 * (never a bottom sheet). Renders a confirm message or form body, then on
 * submit transitions through `loading -> success / error` in place. Closing
 * dismisses the observation without cancelling the operation. This is
 * the canonical surface for destructive confirms (sign out, end space) and
 * small form mutations (rename).
 *
 * Phases come from {@link useMutationLifecycle} (shared with
 * `useMutationButton`), so modal and inline surfaces read the same way.
 *
 * @example
 * ```tsx
 * <MutationModal
 *   visible={open()}
 *   onClose={close}
 *   title={<Trans>End space?</Trans>}
 *   message={<Trans>Everyone will leave. This cannot be undone.</Trans>}
 *   submitLabel={<Trans>End space</Trans>}
 *   variant="destructive"
 *   operation={() => endSpace(spaceId)}
 *   successTitle={<Trans>Space ended</Trans>}
 * />
 * ```
 */
export function MutationModal(props: MutationModalProps): JSX.Element {
  const lifecycle = useMutationLifecycle({
    operation: () => props.operation(),
    onError: (error) => props.onError?.(error),
    onPhaseChange: (transition) => props.onPhaseChange?.(transition),
  });
  // Every open starts from the confirm body again.
  createEffect(
    on(
      () => props.visible,
      (visible) => {
        if (visible && lifecycle.phase() !== 'loading') lifecycle.reset();
      }
    )
  );
  const dismissSuccess = (): void => {
    props.onClose();
    props.onSuccess?.();
  };
  const surfaceClose = (): void =>
    resolveMutationSurfaceClose({
      phase: lifecycle.phase(),
      onClose: props.onClose,
      dismissSuccess,
    });
  const run = (): void => {
    void lifecycle.run();
  };
  const labels = mutationModalLabels(props);
  const ids = mutationModalIds(props);
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={surfaceClose}
      closable
      title={props.title}
      presentation="modal"
      stackId={props.stackId}
      dataSet={{ component: 'MutationModal', ...props.dataSet }}
    >
      <div
        class="box"
        data-component="MutationStateTransition"
        data-phase={lifecycle.phase()}
      >
        <Switch
          fallback={
            <MutationIdle
              labels={labels}
              ids={ids}
              message={props.message}
              destructive={props.variant === 'destructive'}
              submitDisabled={props.submitDisabled ?? false}
              onRun={run}
              onClose={props.onClose}
            >
              {props.children}
            </MutationIdle>
          }
        >
          <Match when={lifecycle.phase() === 'loading'}>
            <MutationLoading labels={labels} onClose={props.onClose} />
          </Match>
          <Match when={lifecycle.phase() === 'success'}>
            <MutationSuccess
              labels={labels}
              ids={ids}
              onDismiss={dismissSuccess}
            />
          </Match>
          <Match when={lifecycle.phase() === 'error'}>
            <MutationError
              ids={ids}
              labels={labels}
              error={lifecycle.error()}
              onRetry={run}
              onClose={props.onClose}
            />
          </Match>
        </Switch>
      </div>
    </ResponsiveSurface>
  );
}
