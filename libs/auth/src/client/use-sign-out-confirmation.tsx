import { MutationModal } from '@pkgs/ui';
import { useLogger } from '@pkgs/logger/react';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, type ReactNode } from 'react';

/**
 * Wraps the sign-out {@link MutationModal}: runs the (offline-safe) `signOut`,
 * shows a loading state, then a dismissible "Signed out" success state. Only
 * unexpected programmer-error throws surface the retryable error state; the
 * provided `signOut` swallows offline / server-revoke failures so the happy
 * path (including offline) always reaches success.
 */
export function useSignOutConfirmationModal(args: {
  signOut: () => Promise<void>;
  signOutConfirmOpen: boolean;
  openSignOutConfirmBase: () => void;
  closeSignOutConfirmBase: () => void;
}): {
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
  modal: ReactNode;
} {
  const {
    signOut,
    signOutConfirmOpen,
    openSignOutConfirmBase,
    closeSignOutConfirmBase,
  } = args;
  const log = useLogger('auth-sign-out');

  const operation = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const onError = useCallback(
    (err: Error) => {
      log.error('sign out failed', { error: err.message });
    },
    [log]
  );

  const modal = useMemo(
    () => (
      <MutationModal
        visible={signOutConfirmOpen}
        onClose={closeSignOutConfirmBase}
        title={<Trans>Sign out?</Trans>}
        message={
          <Trans>You will need to sign in again to sync with your user.</Trans>
        }
        submitLabel={<Trans>Sign out</Trans>}
        variant="destructive"
        operation={operation}
        loadingLabel={<Trans>Signing out…</Trans>}
        successTitle={<Trans>Signed out</Trans>}
        successBody={<Trans>You're signed out on this device.</Trans>}
        errorTitle={<Trans>Sign-out failed</Trans>}
        onError={onError}
      />
    ),
    [signOutConfirmOpen, closeSignOutConfirmBase, operation, onError]
  );

  return {
    openSignOutConfirm: openSignOutConfirmBase,
    closeSignOutConfirm: closeSignOutConfirmBase,
    modal,
  };
}
