import type { SyncActor } from '@libs/auth-shared/auth-context';
import { appAuth, syncActorOf } from '@libs/auth-shared/auth-context';
import { assert } from '@pkgs/assert-root-shared/singleton';
import type { AuthErrorBody } from '@pkgs/sync-engine-shared/v2';

import { apiRequestAsyncLocalStorage } from './request-scope';

export type SessionReplayAuth = SyncActor;

/**
 * Resolve actor/device from session auth (Bearer + x-anon-id).
 * Never trust client body for identity.
 */
export async function resolveSessionReplayAuth(
  request: Request
): Promise<SessionReplayAuth | AuthErrorBody> {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'query/mutations: request store missing');
  try {
    const ctx = await requestStore.sessionAuth.resolveAuthContext(
      requestStore.sqlClient,
      request
    );
    if (ctx['accountDeleted'] === true)
      return {
        error: 'auth',
        reason: 'revoked',
        message: 'Sign in again because this account was deleted.',
      };
    const auth = appAuth(ctx);
    if (auth === null || auth.deviceId === '' || auth.myId.length === 0) {
      return { error: 'auth', reason: 'expired' };
    }
    return syncActorOf(auth);
  } catch {
    return { error: 'auth', reason: 'expired' };
  }
}
