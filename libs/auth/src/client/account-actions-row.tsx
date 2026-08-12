import { Handles } from '@libs/dst-handles';
import { useLingui } from '@lingui/react/macro';
import { Box, Button } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

import { useSignInModal, useSignOutModal } from './auth-modals-provider';
import { useHasAuthSession } from './use-current-user';

/** Sign in / sign out actions for the account screen. */
export function AccountActionsRow(): ReactNode {
  const { t } = useLingui();
  const isSignedIn = useHasAuthSession();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();

  const onSignIn = useCallback(() => {
    openSignInModal();
  }, [openSignInModal]);
  const onRequestSignOut = useCallback(() => {
    openSignOutConfirm();
  }, [openSignOutConfirm]);

  return (
    <Box sx={{ gap: 2 }}>
      {isSignedIn ? (
        <Button
          title={t`Sign out`}
          intent="danger"
          onPress={onRequestSignOut}
          testID={Handles.accountSignOut}
        />
      ) : (
        <Button
          title={t`Sign in`}
          onPress={onSignIn}
          testID={Handles.accountSignIn}
        />
      )}
    </Box>
  );
}
