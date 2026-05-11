import { ACCOUNT_SESSION_ENTITY_TYPE } from '../shared';
import { writeLastLocalAccountId } from './account-local-state';

import { getRegisteredClientStore } from './client-store-register';
import { writeSessionToken } from './session-token-storage';

/**
 * `auth-service` sign-out and `runHostedSessionSync` (Better Auth snapshot) can both
 * call clear in the same tick; serialize so two flows never overlap PatchDB/SQLite.
 */
let clearMirrorsTail: Promise<unknown> = Promise.resolve();

async function runClearLocalAuthMirrorsOnce(): Promise<void> {
  const store = getRegisteredClientStore();
  const log = store.getLogger().child({ namespace: 'auth-cleanup' });
  const storage = store.getSecureStorage();
  try {
    await writeSessionToken(storage, null);
  } catch (e) {
    log.warn('clear session token failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  store.setSessionToken(null);
  try {
    const sessionSvc = await store.getSessionService();
    await sessionSvc.clearSession();
    const stack = await store.getPatchDbStack();
    await stack.sync.markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
      ACCOUNT_SESSION_ENTITY_TYPE
    );
  } catch (e) {
    log.warn('local session cleanup failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    store.setAccountId(null);
    try {
      await writeLastLocalAccountId(storage, null);
    } catch (e) {
      log.warn('clear last local account id failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

/**
 * Clears local session token + legacy PatchDB session mirrors (no hosted-provider calls).
 *
 * Clears `sessionToken` first, then runs PatchDB session cleanup while `accountId`
 * is still set so the SQLite file stays the same until `clearSession` and
 * `markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote` finish (avoids tearing down
 * expo-sqlite mid-flight on web). Invocations are globally serialized.
 */
export async function clearLocalAuthMirrors(): Promise<void> {
  const done = clearMirrorsTail.then(() => runClearLocalAuthMirrorsOnce());
  clearMirrorsTail = done.then(
    () => undefined,
    () => undefined
  );
  await done;
}
