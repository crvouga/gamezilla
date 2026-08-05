import { useLogger } from '@pkgs/logger/react';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { useCallback } from 'react';

import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';
import { useAuthClientPort } from './auth-client-provider';

async function clearActiveSecurePointers(
  storage: ReturnType<typeof useSecureStorage>,
  log: ReturnType<typeof useLogger>
): Promise<void> {
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

/**
 * Signs out via {@link AuthClientPort.signOut} and clears local session
 * pointers (`sessionToken`, `lastLocalAccountId`).
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
      await clearActiveSecurePointers(storage, log);
    }
  }, [port, storage, log]);
}
