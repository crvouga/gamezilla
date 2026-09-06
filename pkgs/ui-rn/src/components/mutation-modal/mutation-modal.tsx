/**
 * `MutationModal` -- one dialog for the whole mutation lifecycle.
 *
 * Always a centered modal via {@link ResponsiveSurface} `presentation="modal"`
 * (never a bottom sheet), including on mobile. Renders a confirm message or
 * form body, then on submit transitions through `loading -> success / error`
 * in place (never closing mid-flight). Success is dismissible; errors are
 * retryable. This is the canonical surface for destructive confirms (sign out,
 * end space, leave space) and small form mutations (rename) so every mutation
 * in the app reads the same way.
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
 * />
 * ```
 */

import { useLingui } from '@lingui/react/macro';
import type { SoundId } from '@pkgs/sounds';
import { type ReactNode, useEffect } from 'react';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useMutationPhaseSoundHandler } from '../../expo/mutation-sounds';
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
  type MutationPhase,
  useMutationLifecycle,
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
  /** Optional hook after the user dismisses the success state. Prefer staying on screen. */
  onSuccess?: (() => void) | undefined;
  /** Override default mutation success/error sounds. */
  sounds?: { success?: SoundId; error?: SoundId } | undefined;
  /**
   * Stable surface-stack id (desktop). Keeps this dialog above remounting
   * underlays when the mutation phase updates chrome.
   */
  stackId?: string | undefined;
  /** `testID` for the idle-phase confirm/submit button. */
  submitTestID?: string | undefined;
  /** `testID` for the success-state block (title region). */
  successTestID?: string | undefined;
  /** `testID` for the success-phase dismiss button. */
  dismissTestID?: string | undefined;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

/** Fixed so loading / success / error share one state band (no grow). */
const STATE_AREA_HEIGHT = 200;
/** Matches `Button` `md` minHeight — loading reserves the same footer band. */
const FOOTER_ACTION_MIN_HEIGHT = 40;

export function MutationModal(props: MutationModalProps): ReactNode {
  const { visible, onClose, title, operation, onError, onSuccess, sounds } =
    props;
  const onPhaseChange = useMutationPhaseSoundHandler(sounds);
  const { phase, error, run, reset } = useMutationLifecycle({
    operation,
    onError,
    onPhaseChange,
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
    <ResponsiveSurface
      visible={visible}
      onClose={surfaceClose}
      title={title}
      presentation="modal"
      {...(props.stackId !== undefined ? { stackId: props.stackId } : {})}
      {...componentDataSet('MutationModal', props.dataSet)}
    >
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
      sx={{
        justifyContent: 'center',
        height: STATE_AREA_HEIGHT,
        overflow: 'hidden',
      }}
    >
      {children}
    </Box>
  );
}

/** Footer band always present so phase swaps do not grow the modal. */
function FooterSlot({ children }: { children?: ReactNode }): ReactNode {
  return (
    <ModalFooter>
      {children ?? <Box sx={{ minHeight: FOOTER_ACTION_MIN_HEIGHT }} />}
    </ModalFooter>
  );
}

function MutationLoading({
  label,
}: {
  label: ReactNode | undefined;
}): ReactNode {
  const { t } = useLingui();
  return (
    <>
      <StateArea>
        <LoadingState caption={label ?? t`Working…`} />
      </StateArea>
      <FooterSlot />
    </>
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
    <>
      <StateArea>
        <SuccessState
          title={props.successTitle}
          body={props.successBody}
          {...(props.successTestID !== undefined
            ? { testID: props.successTestID }
            : {})}
        />
      </StateArea>
      <FooterSlot>
        <ModalButton
          label={props.dismissLabel ?? t`Done`}
          onPress={onDismiss}
          {...(props.dismissTestID !== undefined
            ? { testID: props.dismissTestID }
            : {})}
        />
      </FooterSlot>
    </>
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
      <FooterSlot>
        <ModalButton
          label={props.cancelLabel ?? t`Cancel`}
          variant="cancel"
          onPress={props.onClose}
        />
      </FooterSlot>
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
          {...(props.submitTestID !== undefined
            ? { testID: props.submitTestID }
            : {})}
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
