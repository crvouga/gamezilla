import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/react/macro';
import { Box, Button, LogInIcon, LogOutIcon } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

const BUTTON_ICON_SIZE = 16;

import {
  useSignInModal,
  useSignOutModal,
} from '../../public/auth-modals-provider';
import { useHasAuthSession } from '../../public/use-current-user';

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
    <Box sx={{ alignSelf: 'stretch' }}>
      {isSignedIn ? (
        <Button
          title={t`Sign out`}
          intent="danger"
          variant="outline"
          startIcon={<LogOutIcon size={BUTTON_ICON_SIZE} />}
          onPress={onRequestSignOut}
          testID={Handles.accountSignOut}
        />
      ) : (
        <Button
          title={t`Sign in`}
          startIcon={<LogInIcon size={BUTTON_ICON_SIZE} />}
          onPress={onSignIn}
          testID={Handles.accountSignIn}
        />
      )}
    </Box>
  );
}
