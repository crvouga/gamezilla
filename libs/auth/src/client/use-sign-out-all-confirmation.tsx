import { MutationModal } from '@pkgs/ui';
import { useLogger } from '@pkgs/logger/react';
import { Trans } from '@lingui/react/macro';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

/**
 * Confirm modal for signing out of every local session on this device.
 */
export function useSignOutAllConfirmationModal(args: {
  signOutAll: () => Promise<void>;
}): {
  openSignOutAllConfirm: () => void;
  closeSignOutAllConfirm: () => void;
  modal: ReactNode;
} {
  const { signOutAll } = args;
  const log = useLogger('auth-sign-out-all');
  const [open, setOpen] = useState(false);

  const operation = useCallback(async () => {
    await signOutAll();
  }, [signOutAll]);

  const onError = useCallback(
    (err: Error) => {
      log.error('sign out all failed', { error: err.message });
    },
    [log]
  );

  const modal = useMemo(
    () => (
      <MutationModal
        visible={open}
        onClose={() => setOpen(false)}
        title={<Trans>Sign out of all accounts?</Trans>}
        message={
          <Trans>
            Every account on this device will be signed out. You will need to
            sign in again to sync.
          </Trans>
        }
        submitLabel={<Trans>Sign out all</Trans>}
        variant="destructive"
        operation={operation}
        loadingLabel={<Trans>Signing out…</Trans>}
        successTitle={<Trans>Signed out</Trans>}
        successBody={<Trans>All accounts are signed out on this device.</Trans>}
        errorTitle={<Trans>Sign-out failed</Trans>}
        onError={onError}
      />
    ),
    [open, operation, onError]
  );

  return {
    openSignOutAllConfirm: () => setOpen(true),
    closeSignOutAllConfirm: () => setOpen(false),
    modal,
  };
}
