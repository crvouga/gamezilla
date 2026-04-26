/**
 * Google-only sign-in surface. Shown from the account menu / commands when the user chooses Sign in.
 */

import {
  ModalBody,
  ModalButton,
  ModalFooter,
  ResponsiveSurface,
  Text,
} from '@gamezilla/lib/ui';
import { useCallback, useEffect } from 'react';
import { useAsync } from '@gamezilla/lib/async/use-async';
import type { AuthGoogleProviderState } from './auth-capabilities';
import { SignInGooglePanel } from './sign-in-modal-google-panel';

export type SignInModalProps = {
  visible: boolean;
  onClose: () => void;
  google: AuthGoogleProviderState;
  onSignInWithGoogle: () => Promise<void>;
};

export function SignInModal({
  visible,
  onClose,
  google,
  onSignInWithGoogle,
}: SignInModalProps) {
  const signIn = useAsync({
    operation: async () => {
      await onSignInWithGoogle();
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

  const handleGoogle = useCallback(async () => {
    if (!google.available || loading) return;
    try {
      await run();
    } catch {
      // Hook state already captures and exposes the error.
    }
  }, [google.available, loading, run]);

  return (
    <ResponsiveSurface visible={visible} onClose={onClose} title="Sign in">
      <ModalBody>
        <Text
          variant="body"
          label="Sign in to link this device to your server account. Your data stays local first."
        />
        <SignInGooglePanel
          google={google}
          submitting={loading}
          errorMessage={error?.message ?? null}
          onPressGoogle={() => {
            void handleGoogle();
          }}
        />
      </ModalBody>
      <ModalFooter>
        <ModalButton label="Close" variant="cancel" onPress={onClose} />
      </ModalFooter>
    </ResponsiveSurface>
  );
}
