/**
 * Hosted sign-in surface. Shown from the user menu / commands when the user
 * chooses Sign in.
 *
 * Drives the same `loading -> success / error` lifecycle as
 * {@link MutationModal}, but its idle body is a provider picker rather than a
 * single confirm submit. The loading state is durable across the OAuth
 * redirect (full page unload on web) -- see {@link useSignInModalLifecycle}.
 * Provider buttons never show their own spinner; the whole modal transitions
 * to a loading state instead.
 */

import { useLingui } from '@lingui/react/macro';
import {
  Box,
  ErrorState,
  LoadingState,
  ModalButton,
  ModalFooter,
  MutationStateTransition,
  ResponsiveSurface,
  SuccessState,
} from '@pkgs/ui';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { SignInModalBody } from './sign-in-modal-body';
import {
  useSignInModalLifecycle,
  type SignInPhase,
} from './use-sign-in-modal-lifecycle';

export type SignInModalProps = {
  visible: boolean;
  onClose: () => void;
  /** True when resuming a sign-in that began before an OAuth redirect. */
  resumePending: boolean;
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  /** When true, show the dev-only "Continue with test account" button. */
  devSignInAvailable: boolean;
  onSignInWithHosted: () => Promise<void>;
  onSignInWithDev: () => Promise<void>;
  onError?: ((error: Error) => void) | undefined;
};

const STATE_AREA_MIN_HEIGHT = 200;

export function SignInModal(props: SignInModalProps): ReactNode {
  const { t } = useLingui();
  const { visible, onClose, resumePending, signInAvailable, onError } = props;
  const { phase, error, start, reset } = useSignInModalLifecycle({
    resumePending,
    onError,
  });

  const phaseRef = useRef<SignInPhase>(phase);
  phaseRef.current = phase;
  useEffect(() => {
    if (visible) return;
    // Reset for the next open once the modal is dismissed, but never drop a
    // redirect that is still in flight.
    if (phaseRef.current === 'loading') return;
    reset();
  }, [visible, reset]);

  const trigger = useCallback(
    (runner: () => Promise<void>) => {
      if (!signInAvailable || phaseRef.current === 'loading') return;
      void start(runner);
    },
    [signInAvailable, start]
  );

  const surfaceClose = phase === 'loading' ? () => undefined : onClose;

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={surfaceClose}
      title={t`Sign in`}
    >
      <MutationStateTransition stateKey={phase} active={visible}>
        <SignInPhaseContent
          phase={phase}
          error={error}
          onClose={onClose}
          onRetry={reset}
          idleBody={
            <SignInModalBody
              signInAvailable={props.signInAvailable}
              signInUnavailableReason={props.signInUnavailableReason}
              devSignInAvailable={props.devSignInAvailable}
              onPressGoogle={() => {
                trigger(props.onSignInWithHosted);
              }}
              onPressDev={() => {
                trigger(props.onSignInWithDev);
              }}
            />
          }
        />
      </MutationStateTransition>
    </ResponsiveSurface>
  );
}

function SignInPhaseContent({
  phase,
  error,
  onClose,
  onRetry,
  idleBody,
}: {
  phase: SignInPhase;
  error: Error | null;
  onClose: () => void;
  onRetry: () => void;
  idleBody: ReactNode;
}): ReactNode {
  const { t } = useLingui();
  switch (phase) {
    case 'loading':
      return (
        <StateArea>
          <LoadingState caption={t`Signing in…`} />
        </StateArea>
      );
    case 'success':
      return (
        <StateArea>
          <SuccessState
            title={t`Signed in`}
            body={t`You're signed in on this device.`}
            action={{ label: t`Done`, onPress: onClose }}
          />
        </StateArea>
      );
    case 'error':
      return (
        <SignInErrorContent error={error} onClose={onClose} onRetry={onRetry} />
      );
    default:
      return (
        <>
          {idleBody}
          <ModalFooter>
            <ModalButton label={t`Close`} variant="cancel" onPress={onClose} />
          </ModalFooter>
        </>
      );
  }
}

function SignInErrorContent({
  error,
  onClose,
  onRetry,
}: {
  error: Error | null;
  onClose: () => void;
  onRetry: () => void;
}): ReactNode {
  const { t } = useLingui();
  return (
    <>
      <StateArea>
        <ErrorState
          title={t`Sign-in failed`}
          body={error?.message ?? t`Sign-in was cancelled or didn't finish.`}
          retry={{ label: t`Try again`, onPress: onRetry }}
        />
      </StateArea>
      <ModalFooter>
        <ModalButton label={t`Close`} variant="cancel" onPress={onClose} />
      </ModalFooter>
    </>
  );
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
