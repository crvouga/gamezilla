/**
 * `MutationModal` -- one dialog for the whole mutation lifecycle.
 *
 * Renders a confirm message or form body, then on submit transitions through
 * `loading -> success / error` in place (never closing mid-flight). Success is
 * dismissible; errors are retryable. This is the canonical surface for
 * destructive confirms (sign out, end space, leave space) and small form
 * mutations (rename) so every mutation in the app reads the same way.
 *
 * @example
 * ```tsx
 * <MutationModal
 *   visible={open}
 *   onClose={close}
 *   title={<Trans>End space?</Trans>}
 *   message={<Trans>Everyone will leave. This cannot be undone.</Trans>}
 *   submitLabel={<Trans>End space</Trans>}
 *   variant="destructive"
 *   operation={() => endSpace(spaceId)}
 *   successTitle={<Trans>Space ended</Trans>}
 *   onSuccess={() => router.back()}
 * />
 * ```
 */

import { useLingui } from '@lingui/react/macro';
import { useEffect, type ReactNode } from 'react';
import { Box } from '../box';
import { ErrorState } from '../error-state';
import { LoadingState } from '../loading-state';
import { ModalBody } from '../modal/modal-body';
import { ModalButton } from '../modal/modal-button';
import { ModalFooter } from '../modal/modal-footer';
import { ResponsiveSurface } from '../responsive-surface';
import { SuccessState } from '../success-state';
import { MutationStateTransition } from './mutation-modal-transition';
import {
  useMutationLifecycle,
  type MutationPhase,
} from './use-mutation-lifecycle';

export type MutationModalProps = {
  visible: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Plain confirmation copy. Ignored when `children` is provided. */
  message?: ReactNode | undefined;
  /** Custom idle-phase body (e.g. form fields). Takes precedence over `message`. */
  children?: ReactNode | undefined;
  /** The mutation to run on submit. Wrap in `useCallback` for stability. */
  operation: () => Promise<void>;
  submitLabel: ReactNode;
  cancelLabel?: ReactNode | undefined;
  /** Submit button color role. Defaults to `'default'`. */
  variant?: 'default' | 'destructive' | undefined;
  /** Disable the submit button (e.g. failed form validation). */
  submitDisabled?: boolean | undefined;
  /** Caption under the spinner while running. */
  loadingLabel?: ReactNode | undefined;
  successTitle: ReactNode;
  successBody?: ReactNode | undefined;
  /** Defaults to a generic localized failure title. */
  errorTitle?: ReactNode | undefined;
  /** Success dismiss button label. Defaults to "Done". */
  dismissLabel?: ReactNode | undefined;
  /** Error retry button label. Defaults to "Try again". */
  retryLabel?: ReactNode | undefined;
  /** Notified on failure (e.g. logging). */
  onError?: ((error: Error) => void) | undefined;
  /** Runs after the user dismisses the success state (e.g. navigation). */
  onSuccess?: (() => void) | undefined;
};

const STATE_AREA_MIN_HEIGHT = 200;

export function MutationModal(props: MutationModalProps): ReactNode {
  const { visible, onClose, title, operation, onError, onSuccess } = props;
  const { phase, error, run, reset } = useMutationLifecycle({
    operation,
    onError,
  });

  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const dismissSuccess = () => {
    onClose();
    onSuccess?.();
  };
  const surfaceClose = resolveSurfaceClose({
    phase,
    onClose,
    dismissSuccess,
  });

  return (
    <ResponsiveSurface visible={visible} onClose={surfaceClose} title={title}>
      <MutationStateTransition stateKey={phase} active={visible}>
        <MutationModalBody
          props={props}
          phase={phase}
          error={error}
          onRun={() => {
            void run();
          }}
          onDismissSuccess={dismissSuccess}
        />
      </MutationStateTransition>
    </ResponsiveSurface>
  );
}

function resolveSurfaceClose({
  phase,
  onClose,
  dismissSuccess,
}: {
  phase: MutationPhase;
  onClose: () => void;
  dismissSuccess: () => void;
}): () => void {
  if (phase === 'loading') return () => undefined;
  if (phase === 'success') return dismissSuccess;
  return onClose;
}

function MutationModalBody({
  props,
  phase,
  error,
  onRun,
  onDismissSuccess,
}: {
  props: MutationModalProps;
  phase: MutationPhase;
  error: Error | null;
  onRun: () => void;
  onDismissSuccess: () => void;
}): ReactNode {
  switch (phase) {
    case 'loading':
      return <MutationLoading label={props.loadingLabel} />;
    case 'success':
      return <MutationSuccess props={props} onDismiss={onDismissSuccess} />;
    case 'error':
      return <MutationError props={props} error={error} onRetry={onRun} />;
    default:
      return <MutationIdle props={props} onRun={onRun} />;
  }
}

function StateArea({ children }: { children: ReactNode }): ReactNode {
  return (
    <Box
      sx={{ justifyContent: 'center' }}
      style={{ minHeight: STATE_AREA_MIN_HEIGHT }}
    >
      {children}
    </Box>
  );
}

function MutationLoading({
  label,
}: {
  label: ReactNode | undefined;
}): ReactNode {
  const { t } = useLingui();
  return (
    <StateArea>
      <LoadingState caption={label ?? t`Working…`} />
    </StateArea>
  );
}

function MutationSuccess({
  props,
  onDismiss,
}: {
  props: MutationModalProps;
  onDismiss: () => void;
}): ReactNode {
  const { t } = useLingui();
  return (
    <StateArea>
      <SuccessState
        title={props.successTitle}
        body={props.successBody}
        action={{ label: props.dismissLabel ?? t`Done`, onPress: onDismiss }}
      />
    </StateArea>
  );
}

function MutationError({
  props,
  error,
  onRetry,
}: {
  props: MutationModalProps;
  error: Error | null;
  onRetry: () => void;
}): ReactNode {
  const { t } = useLingui();
  return (
    <>
      <StateArea>
        <ErrorState
          title={props.errorTitle ?? t`Something went wrong`}
          body={error?.message}
          retry={{ label: props.retryLabel ?? t`Try again`, onPress: onRetry }}
        />
      </StateArea>
      <ModalFooter>
        <ModalButton
          label={props.cancelLabel ?? t`Cancel`}
          variant="cancel"
          onPress={props.onClose}
        />
      </ModalFooter>
    </>
  );
}

function MutationIdle({
  props,
  onRun,
}: {
  props: MutationModalProps;
  onRun: () => void;
}): ReactNode {
  const { t } = useLingui();
  const submitVariant =
    props.variant === 'destructive' ? 'destructive' : 'default';
  return (
    <>
      {props.children !== undefined ? (
        <Box sx={{ mb: 4 }}>{props.children}</Box>
      ) : (
        <ModalBody message={props.message} />
      )}
      <ModalFooter>
        <ModalButton
          label={props.submitLabel}
          variant={submitVariant}
          disabled={props.submitDisabled ?? false}
          onPress={onRun}
        />
        <ModalButton
          label={props.cancelLabel ?? t`Cancel`}
          variant="cancel"
          onPress={props.onClose}
        />
      </ModalFooter>
    </>
  );
}
