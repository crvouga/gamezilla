import { SessionCapabilityStore } from '@libs/auth-shared-ts/session-capability';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { useSecureStorageStore } from '@pkgs/secure-storage-root-client-ts/solid';
import { useAuthClientPort } from './auth-client-provider';
import { useSignOutIntent } from './sign-out-intent';

/**
 * Signs out via {@link AuthClientPort.signOut} and clears the session capability.
 * {@link AuthBridge} then runs `POST /identity/anon/ensure` to mint/bind a fresh
 * anon `users` row into `currentUserId`.
 */
export function useSignOut(): () => Promise<void> {
  const log = useLogger('auth-sign-out');
  const port = useAuthClientPort();
  const store = useSecureStorageStore();
  const intent = useSignOutIntent();

  return async () => {
    intent.expect();
    // Drop product session capability first so chrome cannot read a stale
    // signed-in token while the auth-port sign-out / session refetch is in flight.
    try {
      await new SessionCapabilityStore(store).clear();
    } catch (err) {
      log.warn('clear session capability failed', {
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
        await new SessionCapabilityStore(store).clear();
      } catch (err) {
        log.warn('clear session capability failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };
}
