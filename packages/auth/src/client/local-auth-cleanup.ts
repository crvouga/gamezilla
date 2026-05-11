import { ACCOUNT_SESSION_ENTITY_TYPE } from '../shared';
import type { Logger } from '@gamezilla/lib/logger/logger';
import type { SecureStorage } from '@gamezilla/lib/secure-storage/interface';
import type { SyncPatchDb } from '@gamezilla/patch-db/impl-sync/impl-sync';

import { writeLastLocalAccountId } from './account-local-state';
import type { AccountIdModel } from './account-id-context';
import type { SessionTokenModel } from './session-token-context';
import { writeSessionToken } from './session-token-storage';
import type { SessionService } from './session-service';

/**
 * `signOut` and `runHostedSessionSync` (Better Auth snapshot) can both call
 * clear in the same tick; serialize so two flows never overlap PatchDB writes.
 */
let clearMirrorsTail: Promise<unknown> = Promise.resolve();

export type LocalAuthCleanupDeps = {
  logger: Logger;
  secure: SecureStorage;
  sessionToken: SessionTokenModel;
  accountId: AccountIdModel;
  getSessionService: () => SessionService;
  getSync: () => SyncPatchDb;
};

async function runClearLocalAuthMirrorsOnce(
  deps: LocalAuthCleanupDeps
): Promise<void> {
  const log = deps.logger.child({ namespace: 'auth-cleanup' });
  const storage = deps.secure;
  try {
    await writeSessionToken(storage, null);
  } catch (e) {
    log.warn('clear session token failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  deps.sessionToken.setSessionToken(null);
  try {
    const sessionSvc = deps.getSessionService();
    await sessionSvc.clearSession();
    await deps
      .getSync()
      .markAllUnsyncedPatchesForEntityTypeAsAlreadyOnRemote(
        ACCOUNT_SESSION_ENTITY_TYPE
      );
  } catch (e) {
    log.warn('local session cleanup failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    deps.accountId.setAccountId(null);
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
 * Clears the in-memory + persisted session token / accountId and tells the sync
 * engine to drop pending pushes for `ACCOUNT_SESSION_ENTITY_TYPE`. With a
 * single shared `main` SQLite database there is no per-account file to detach
 * or delete; sign-out only retires server-bound auth state.
 *
 * Invocations are globally serialized so racing sign-out paths never overlap.
 */
export async function clearLocalAuthMirrors(
  deps: LocalAuthCleanupDeps
): Promise<void> {
  const done = clearMirrorsTail.then(() => runClearLocalAuthMirrorsOnce(deps));
  clearMirrorsTail = done.then(
    () => undefined,
    () => undefined
  );
  await done;
}
