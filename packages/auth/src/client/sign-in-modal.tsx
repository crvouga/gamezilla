/**
 * Hosted sign-in surface. Shown from the user menu / commands when the user chooses Sign in.
 */

import { useAsync } from '@gamezilla/lib/async/use-async';
import { ModalButton, ModalFooter, ResponsiveSurface } from '@gamezilla/ui';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useCallback, useEffect } from 'react';
import { SignInModalBody } from './sign-in-modal-body';

export type SignInModalProps = {
  visible: boolean;
  onClose: () => void;
  signInAvailable: boolean;
  signInUnavailableReason: string | null;
  onSignInWithHosted: () => Promise<void>;
};

export function SignInModal({
  visible,
  onClose,
  signInAvailable,
  signInUnavailableReason,
  onSignInWithHosted,
}: SignInModalProps) {
  const signIn = useAsync({
    operation: async () => {
      await onSignInWithHosted();
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

  const handleHostedSignIn = useCallback(async () => {
    if (!signInAvailable || loading) return;
    try {
      await run();
    } catch {
      // Hook state already captures and exposes the error.
    }
  }, [signInAvailable, loading, run]);

  const errorMessage =
    error === null || error === undefined ? undefined : error.message;

  return (
    <ResponsiveSurface visible={visible} onClose={onClose} title={t`Sign in`}>
      <SignInModalBody
        signInAvailable={signInAvailable}
        signInUnavailableReason={signInUnavailableReason}
        errorMessage={errorMessage}
        loading={loading}
        onPressGoogle={() => {
          void handleHostedSignIn();
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
