import { ACCOUNT_SESSION_ENTITY_TYPE } from '../shared';
import {
  accountIdAtom,
  loggerAtom,
  patchDbStackAtom,
  secureStorageAtom,
  sessionServiceAtom,
  sessionTokenAtom,
} from '@gamezilla/client/runtime/atoms';
import { getDefaultStore } from 'jotai';
import { writeLastLocalAccountId } from '@gamezilla/auth/client/account-local-state';
import { writeSessionToken } from './session-token-storage';

/**
 * `auth-service` sign-out and `runHostedSessionSync` (Better Auth snapshot) can both
 * call clear in the same tick; serialize so two flows never overlap PatchDB/SQLite.
 */
let clearMirrorsTail: Promise<unknown> = Promise.resolve();

async function runClearLocalAuthMirrorsOnce(): Promise<void> {
  const store = getDefaultStore();
  const log = store.get(loggerAtom).child({ namespace: 'auth-cleanup' });
  const storage = store.get(secureStorageAtom);
  try {
    await writeSessionToken(storage, null);
  } catch (e) {
    log.warn('clear session token failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  store.set(sessionTokenAtom, null);
  try {
    const sessionSvc = await store.get(sessionServiceAtom);
    await sessionSvc.clearSession();
    const stack = await store.get(patchDbStackAtom);
    await stack.sync.markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
      ACCOUNT_SESSION_ENTITY_TYPE
    );
  } catch (e) {
    log.warn('local session cleanup failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    store.set(accountIdAtom, null);
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
 * Clears Gamezilla session atoms + legacy PatchDB session mirrors (no hosted-provider calls).
 *
 * Clears `sessionTokenAtom` first, then runs PatchDB session cleanup while `accountIdAtom`
 * is still set so `sqlClientAtom` / `patchDbStackAtom` keep the same on-disk DB until
 * `clearSession` and `markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote` finish (avoids
 * tearing down expo-sqlite mid-flight on web). Invocations are globally serialized.
 */
export async function clearLocalAuthMirrors(): Promise<void> {
  const done = clearMirrorsTail.then(() => runClearLocalAuthMirrorsOnce());
  clearMirrorsTail = done.then(
    () => undefined,
    () => undefined
  );
  await done;
}
