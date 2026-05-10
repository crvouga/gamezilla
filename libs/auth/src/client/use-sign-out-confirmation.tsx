import { ConfirmationModal } from '@gamezilla/lib/ui';
import { useLogger } from '@gamezilla/client/runtime/runtime-hooks';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

/**
 * Wraps the sign-out {@link ConfirmationModal}: closes on success, keeps the
 * modal open and shows a localized error only for unexpected programmer-error
 * throws. `auth-service.signOut` swallows offline / server-revoke failures so
 * the happy path (including offline) always closes the modal.
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
  const { t } = useLingui();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const openSignOutConfirm = useCallback(() => {
    setError(null);
    openSignOutConfirmBase();
  }, [openSignOutConfirmBase]);

  const closeSignOutConfirm = useCallback(() => {
    setError(null);
    setSubmitting(false);
    closeSignOutConfirmBase();
  }, [closeSignOutConfirmBase]);

  const onConfirm = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await signOut();
      closeSignOutConfirm();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(t`Sign-out failed: ${detail}`);
      log.error('sign out failed', { error: detail });
    } finally {
      setSubmitting(false);
    }
  }, [signOut, closeSignOutConfirm, t, log]);

  const modal = useMemo(
    () => (
      <ConfirmationModal
        visible={signOutConfirmOpen}
        title={<Trans>Sign out?</Trans>}
        message={
          <Trans>You will need to sign in again to sync with your user.</Trans>
        }
        confirmError={error ?? undefined}
        submitting={submitting}
        confirmLabel={
          submitting ? <Trans>Signing out…</Trans> : <Trans>Sign out</Trans>
        }
        cancelLabel={<Trans>Cancel</Trans>}
        variant="destructive"
        onConfirm={onConfirm}
        onCancel={closeSignOutConfirm}
      />
    ),
    [signOutConfirmOpen, error, submitting, onConfirm, closeSignOutConfirm]
  );

  return { openSignOutConfirm, closeSignOutConfirm, modal };
}
