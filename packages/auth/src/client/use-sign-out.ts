import { useLogger } from '@gamezilla/lib/logger/react';
import { useSecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { writeSecureStorageItem } from '@gamezilla/lib/secure-storage/use-secure-storage-item';
import { useCallback, useMemo } from 'react';

import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';
import { authBaseUrl, useAuthClient } from './better-auth-client';
import { useConfigService } from './config-service-context';

/**
 * Signs out of Better Auth and clears the locally cached bearer + accountId.
 * The server-side `account/session` row is left in place — the next refresh
 * from another device will rotate or expire it; offline sign-out still works
 * because the local clear runs regardless of the network call's outcome.
 */
export function useSignOut(): () => Promise<void> {
  const log = useLogger('auth-sign-out');
  const apiUrl = useConfigService().getApiUrl();
  const baseURL = useMemo(() => authBaseUrl(apiUrl), [apiUrl]);
  const authClient = useAuthClient(baseURL);
  const storage = useSecureStorage();

  return useCallback(async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      log.warn('Hosted sign-out failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      try {
        await writeSecureStorageItem(storage, SESSION_TOKEN_KEY, null);
      } catch (err) {
        log.warn('clear session token failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      try {
        await writeSecureStorageItem(storage, LAST_LOCAL_ACCOUNT_ID_KEY, null);
      } catch (err) {
        log.warn('clear last local account id failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, [authClient, storage, log]);
}
