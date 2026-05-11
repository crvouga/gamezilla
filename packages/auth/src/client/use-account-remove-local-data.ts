import { removeLocalDataForAccount } from '@gamezilla/client-runtime/patch-db-runtime';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';

type UseAccountRemoveLocalDataArgs = {
  readonly accountId: string | null;
  readonly secureStorage: SecureStorage;
  readonly refreshSession: () => Promise<void>;
};

/**
 * Native-only: confirms then deletes this account's local SQLite file and reopens anonymous.
 */
export function useAccountRemoveLocalData({
  accountId,
  secureStorage,
  refreshSession,
}: UseAccountRemoveLocalDataArgs): () => void {
  const { t } = useLingui();

  return useCallback(() => {
    if (accountId === null || Platform.OS === 'web') return;
    const id = accountId;
    Alert.alert(
      t`Remove local data?`,
      t`This deletes the offline database file for this account on this device. You stay signed in; data will re-download from the server.`,
      [
        {
          text: t`Cancel`,
          style: 'cancel',
        },
        {
          text: t`Remove`,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await removeLocalDataForAccount(id, secureStorage);
                await refreshSession();
              } catch (err: unknown) {
                Alert.alert(
                  t`Could not remove local data`,
                  err instanceof Error ? err.message : String(err)
                );
              }
            })();
          },
        },
      ]
    );
  }, [accountId, refreshSession, secureStorage, t]);
}
