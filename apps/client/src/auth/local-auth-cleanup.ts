import { ACCOUNT_SESSION_ENTITY_TYPE } from '@gamezilla/domain/auth';
import {
  accountIdAtom,
  loggerAtom,
  patchDbStackAtom,
  secureStorageAtom,
  sessionServiceAtom,
  sessionTokenAtom,
} from '@gamezilla/client/runtime/atoms';
import { getDefaultStore } from 'jotai';
import { writeLastLocalAccountId } from '@gamezilla/client/db/account-local-state';
import { writeSessionToken } from './session-token-storage';

/** Clears Gamezilla session atoms + legacy PatchDB session mirrors (no hosted-provider calls). */
export async function clearLocalAuthMirrors(): Promise<void> {
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
  store.set(accountIdAtom, null);
  await writeLastLocalAccountId(storage, null);
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
  }
}
