import { useLogger } from '@pkgs/logger/react';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { useCallback } from 'react';

import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';
import { useAuthClientPort } from './auth-client-provider';

/**
 * Signs out via {@link AuthClientPort.signOut} and clears the locally cached
 * bearer + accountId. The server-side `account/session` row is left in place —
 * the next refresh from another device will rotate or expire it; offline
 * sign-out still works because the local clear runs regardless of the network
 * call's outcome.
 */
export function useSignOut(): () => Promise<void> {
  const log = useLogger('auth-sign-out');
  const port = useAuthClientPort();
  const storage = useSecureStorage();

  return useCallback(async () => {
    try {
      await port.signOut();
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
  }, [port, storage, log]);
}
