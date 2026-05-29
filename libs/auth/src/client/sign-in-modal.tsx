/**
 * Hosted sign-in surface. Shown from the user menu / commands when the user chooses Sign in.
 */

import { useAsync } from '@pkgs/async/use-async';
import { ModalButton, ModalFooter, ResponsiveSurface } from '@pkgs/ui';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useCallback, useEffect } from 'react';
import { SignInModalBody } from './sign-in-modal-body';

export type SignInModalProps = {
  visible: boolean;
  onClose: () => void;
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  /** When true, show the dev-only "Continue with test account" button. */
  devSignInAvailable: boolean;
  onSignInWithHosted: () => Promise<void>;
  onSignInWithDev: () => Promise<void>;
};

export function SignInModal({
  visible,
  onClose,
  signInAvailable,
  signInUnavailableReason,
  devSignInAvailable,
  onSignInWithHosted,
  onSignInWithDev,
}: SignInModalProps) {
  const signIn = useAsync({
    operation: async (_ctx, runner: () => Promise<void>) => {
      await runner();
      onClose();
    },
  });
  const { loading, error, run, reset, cancelAll } = signIn;

  useEffect(() => {
    if (visible) {
      reset();
      return;
    }
    cancelAll('Sign-in modal closed');
  }, [cancelAll, reset, visible]);

  const trigger = useCallback(
    async (runner: () => Promise<void>) => {
      if (!signInAvailable || loading) return;
      try {
        await run(runner);
      } catch {
        // Hook state already captures and exposes the error.
      }
    },
    [signInAvailable, loading, run]
  );

  const errorMessage =
    error === null || error === undefined ? undefined : error.message;

  return (
    <ResponsiveSurface visible={visible} onClose={onClose} title={t`Sign in`}>
      <SignInModalBody
        signInAvailable={signInAvailable}
        signInUnavailableReason={signInUnavailableReason}
        errorMessage={errorMessage}
        loading={loading}
        devSignInAvailable={devSignInAvailable}
        onPressGoogle={() => {
          void trigger(onSignInWithHosted);
        }}
        onPressDev={() => {
          void trigger(onSignInWithDev);
        }}
      />
      <ModalFooter>
        <ModalButton
          label={<Trans>Close</Trans>}
          variant="cancel"
          onPress={onClose}
        />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
