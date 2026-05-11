import { useAuth } from './auth-context';
import { Box, Button } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

/** Sign in / sign out actions for the account screen. */
export function AccountActionsRow(): ReactNode {
  const { t } = useLingui();
  const { isAuthenticated, openSignInModal, openSignOutConfirm } = useAuth();
  const onSignIn = useCallback(() => {
    openSignInModal();
  }, [openSignInModal]);
  const onRequestSignOut = useCallback(() => {
    openSignOutConfirm();
  }, [openSignOutConfirm]);

  return (
    <Box sx={{ gap: 2 }}>
      {isAuthenticated ? (
        <Button
          title={t`Sign out`}
          intent="danger"
          onPress={onRequestSignOut}
        />
      ) : (
        <Button title={t`Sign in`} onPress={onSignIn} />
      )}
    </Box>
  );
}
