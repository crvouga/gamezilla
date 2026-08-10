import { useLogger } from '@pkgs/logger/react';
import {
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import { useCallback } from 'react';
import { useAuthClientPort } from './auth-client-provider';
import { SESSION_TOKEN_KEY } from './auth-storage-keys';

/**
 * Signs out via {@link AuthClientPort.signOut} and clears the session token.
 * {@link AuthBridge} then runs `POST /identity/anon/ensure` to mint/bind a fresh
 * anon `users` row into `currentUserId`.
 */
export function useSignOut(): () => Promise<void> {
  const log = useLogger('auth-sign-out');
  const port = useAuthClientPort();
  const store = useSecureStorageStore();

  return useCallback(async () => {
    // Drop product sessionToken first so chrome cannot read a stale signed-in
    // token while the auth-port sign-out / session refetch is in flight.
    try {
      await writeSecureStorageItem(store, SESSION_TOKEN_KEY, null);
    } catch (err) {
      log.warn('clear session token failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    try {
      await port.signOut();
    } catch (err) {
      log.warn('Hosted sign-out failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      try {
        await writeSecureStorageItem(store, SESSION_TOKEN_KEY, null);
      } catch (err) {
        log.warn('clear session token failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, [port, store, log]);
}
