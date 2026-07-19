/**
 * Hosted sign-in surface. Shown from the user menu / commands when the user
 * chooses Sign in or Add account.
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
import type { SignInIntent } from './sign-in-pending';
import {
  useSignInModalLifecycle,
  type SignInPhase,
} from './use-sign-in-modal-lifecycle';

export type SignInModalProps = {
  visible: boolean;
  onClose: () => void;
  /** True when resuming a sign-in that began before an OAuth redirect. */
  resumePending: boolean;
  intent: SignInIntent;
  resumeBaselineSessionIds?: readonly string[];
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  onSignInWithHosted: () => Promise<void>;
  onError?: ((error: Error) => void) | undefined;
};

const STATE_AREA_MIN_HEIGHT = 200;

export function SignInModal(props: SignInModalProps): ReactNode {
  const { t } = useLingui();
  const {
    visible,
    onClose,
    resumePending,
    intent,
    resumeBaselineSessionIds,
    signInAvailable,
    onError,
  } = props;
  const { phase, error, start, reset, dismiss } = useSignInModalLifecycle({
    resumePending,
    intent,
    ...(resumeBaselineSessionIds !== undefined
      ? { resumeBaselineSessionIds }
      : {}),
    ...(onError !== undefined ? { onError } : {}),
  });

  const phaseRef = useRef<SignInPhase>(phase);
  phaseRef.current = phase;
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    if (visible) {
      wasVisibleRef.current = true;
      return;
    }
    if (!wasVisibleRef.current) return;
    if (phaseRef.current === 'loading') return;
    if (phaseRef.current === 'success') return;
    reset();
  }, [visible, reset]);

  const trigger = useCallback(
    (runner: () => Promise<void>) => {
      if (!signInAvailable || phaseRef.current === 'loading') return;
      void start(runner);
    },
    [signInAvailable, start]
  );

  const dismissModal = useCallback(() => {
    dismiss();
    onClose();
  }, [dismiss, onClose]);

  const surfaceClose = phase === 'loading' ? () => undefined : dismissModal;
  const title = intent === 'addAccount' ? t`Add account` : t`Sign in`;

  return (
    <ResponsiveSurface visible={visible} onClose={surfaceClose} title={title}>
      <MutationStateTransition stateKey={phase} active={visible}>
        <SignInPhaseContent
          phase={phase}
          intent={intent}
          error={error}
          onClose={onClose}
          onDismiss={dismissModal}
          onRetry={reset}
          idleBody={
            <SignInModalBody
              signInAvailable={props.signInAvailable}
              signInUnavailableReason={props.signInUnavailableReason}
              onPressGoogle={() => {
                trigger(props.onSignInWithHosted);
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
  intent,
  error,
  onClose,
  onDismiss,
  onRetry,
  idleBody,
}: {
  phase: SignInPhase;
  intent: SignInIntent;
  error: Error | null;
  onClose: () => void;
  onDismiss: () => void;
  onRetry: () => void;
  idleBody: ReactNode;
}): ReactNode {
  const { t } = useLingui();
  switch (phase) {
    case 'loading':
      return (
        <StateArea>
          <LoadingState
            caption={
              intent === 'addAccount' ? t`Adding account…` : t`Signing in…`
            }
          />
        </StateArea>
      );
    case 'success':
      return (
        <StateArea>
          <SuccessState
            title={intent === 'addAccount' ? t`Account added` : t`Signed in`}
            body={
              intent === 'addAccount'
                ? t`You can switch accounts from the avatar menu.`
                : t`You're signed in on this device.`
            }
            action={{ label: t`Done`, onPress: onDismiss }}
          />
        </StateArea>
      );
    case 'error':
      return (
        <SignInErrorContent
          intent={intent}
          error={error}
          onClose={onClose}
          onRetry={onRetry}
        />
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
  intent,
  error,
  onClose,
  onRetry,
}: {
  intent: SignInIntent;
  error: Error | null;
  onClose: () => void;
  onRetry: () => void;
}): ReactNode {
  const { t } = useLingui();
  return (
    <>
      <StateArea>
        <ErrorState
          title={
            intent === 'addAccount'
              ? t`Couldn't add account`
              : t`Sign-in failed`
          }
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
