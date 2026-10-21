import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { Accessor, JSX } from 'solid-js';

/**
 * Wraps the sign-out {@link MutationModal}: runs the (offline-safe) `signOut`,
 * shows a loading state, then a dismissible "Signed out" success state. Only
 * unexpected programmer-error throws surface the retryable error state; the
 * provided `signOut` swallows offline / server-revoke failures so the happy
 * path (including offline) always reaches success.
 */
export function useSignOutConfirmationModal(args: {
  signOut: () => Promise<void>;
  signOutConfirmOpen: Accessor<boolean>;
  openSignOutConfirmBase: () => void;
  closeSignOutConfirmBase: () => void;
}): {
  openSignOutConfirm: () => void;
  closeSignOutConfirm: () => void;
  modal: JSX.Element;
} {
  const log = useLogger('auth-sign-out');

  const operation = async () => {
    await args.signOut();
  };

  const onError = (err: Error) => {
    log.error('sign out failed', { error: err.message });
  };

  const modal = (
    <MutationModal
      visible={args.signOutConfirmOpen()}
      onClose={args.closeSignOutConfirmBase}
      title={<Trans>Sign out?</Trans>}
      message={<Trans>You'll be signed out on this device.</Trans>}
      submitLabel={<Trans>Sign out</Trans>}
      variant="destructive"
      operation={operation}
      loadingLabel={<Trans>Signing out…</Trans>}
      successTitle={<Trans>Signed out</Trans>}
      successBody={<Trans>You're signed out on this device.</Trans>}
      errorTitle={<Trans>Sign-out failed</Trans>}
      onError={onError}
      submitDataSet={{ testid: Handles.authSignOutConfirm }}
      successDataSet={{ testid: Handles.authSignedOut }}
      dismissDataSet={{ testid: Handles.authSignOutDone }}
      dataSet={{ testid: Handles.authSignOutModal }}
    />
  );

  return {
    openSignOutConfirm: args.openSignOutConfirmBase,
    closeSignOutConfirm: args.closeSignOutConfirmBase,
    modal,
  };
}
