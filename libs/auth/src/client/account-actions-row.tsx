import { Box, Button } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';

import { useSignInModal, useSignOutModal } from './auth-modals-provider';
import { useIsSignedIn } from './use-current-user';
import { useLocalAccounts } from './use-local-accounts';
import { useSignOut } from './use-sign-out';
import { useSignOutAllConfirmationModal } from './use-sign-out-all-confirmation';

/** Sign in / sign out actions for the account screen. */
export function AccountActionsRow(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const isSignedIn = useIsSignedIn();
  const accounts = useLocalAccounts();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();
  const signOut = useSignOut();
  const { openSignOutAllConfirm, modal: signOutAllModal } =
    useSignOutAllConfirmationModal({
      signOutAll: async () => {
        await signOut({ scope: 'all' });
        router.replace('/');
      },
    });

  const onSignIn = useCallback(() => {
    openSignInModal();
  }, [openSignInModal]);
  const onRequestSignOut = useCallback(() => {
    openSignOutConfirm();
  }, [openSignOutConfirm]);

  const showSignOutAll = isSignedIn && accounts.length > 1;

  return (
    <Box sx={{ gap: 2 }}>
      {isSignedIn ? (
        <>
          <Button
            title={t`Sign out`}
            intent="danger"
            onPress={onRequestSignOut}
          />
          {showSignOutAll ? (
            <Button
              title={t`Sign out of all accounts`}
              intent="danger"
              variant="outline"
              onPress={openSignOutAllConfirm}
            />
          ) : null}
          {signOutAllModal}
        </>
      ) : (
        <Button title={t`Sign in`} onPress={onSignIn} />
      )}
    </Box>
  );
}
