import { useLogger } from '@pkgs/logger/react';
import type { SignOutOptions } from '@pkgs/auth/client/account-session';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { useCallback } from 'react';

import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';
import { useAuthClientPort } from './auth-client-provider';
import {
  removeRosterAccount,
  removeRosterSession,
  trimRosterToSessions,
} from './local-account-roster';
import { useLocalAccountRoster } from './use-local-account-roster';
import { useCurrentAccountId } from './use-current-account-id';

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
 * Signs out via {@link AuthClientPort.signOut}. Default scope is `active`
 * (leave other local sessions). Pass `{ scope: 'all' }` to clear every session
 * on this device. Secure-storage pointers clear only when no sessions remain.
 */
export function useSignOut(): (options?: SignOutOptions) => Promise<void> {
  const log = useLogger('auth-sign-out');
  const port = useAuthClientPort();
  const storage = useSecureStorage();
  const accountId = useCurrentAccountId();
  const [, setRoster] = useLocalAccountRoster();
  const sessionsBefore = port.useAccountSessions();

  return useCallback(
    async (options?: SignOutOptions) => {
      const scope = options?.scope ?? 'active';
      const activeSession = sessionsBefore.find((session) => session.isActive);
      try {
        await port.signOut({ scope });
      } catch (err) {
        log.warn('Hosted sign-out failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (scope === 'all') {
          setRoster([]);
          await clearActiveSecurePointers(storage, log);
          return;
        }
        const remainingIds = new Set(
          sessionsBefore
            .filter((session) => session.sessionId !== activeSession?.sessionId)
            .map((session) => session.sessionId)
        );
        if (accountId !== null) {
          setRoster((prev) =>
            trimRosterToSessions(
              removeRosterAccount(prev, accountId),
              remainingIds
            )
          );
        } else if (activeSession !== undefined) {
          setRoster((prev) =>
            trimRosterToSessions(
              removeRosterSession(prev, activeSession.sessionId),
              remainingIds
            )
          );
        }
        if (remainingIds.size === 0) {
          await clearActiveSecurePointers(storage, log);
        }
      }
    },
    [port, storage, log, accountId, setRoster, sessionsBefore]
  );
}
