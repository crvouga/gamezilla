import { useAuth } from './auth-context';
import { useSecureStorage } from '@gamezilla/client/runtime/runtime-hooks';
import { useAccountRemoveLocalData } from './use-account-remove-local-data';
import { Box, Button } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';
import { Platform } from 'react-native';

/** Sign in / sign out / remove-local-data actions for the account screen. */
export function AccountActionsRow(): ReactNode {
  const { t } = useLingui();
  const auth = useAuth();
  const secureStorage = useSecureStorage();
  const onRemoveLocalData = useAccountRemoveLocalData({
    accountId: auth.accountId,
    secureStorage,
    refreshSession: auth.refreshSession,
  });
  const onSignIn = useCallback(() => {
    auth.openSignInModal();
  }, [auth]);
  const onRequestSignOut = useCallback(() => {
    auth.openSignOutConfirm();
  }, [auth]);

  return (
    <Box sx={{ gap: 2 }}>
      {auth.isAuthenticated ? (
        <>
          {Platform.OS !== 'web' ? (
            <Button
              title={t`Remove local data for this account`}
              intent="danger"
              onPress={onRemoveLocalData}
            />
          ) : null}
          <Button
            title={t`Sign out`}
            intent="danger"
            onPress={onRequestSignOut}
          />
        </>
      ) : (
        <Button title={t`Sign in`} onPress={onSignIn} />
      )}
    </Box>
  );
}
