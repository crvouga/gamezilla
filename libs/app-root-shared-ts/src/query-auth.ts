import type { SyncActor } from '@libs/auth-shared-ts/auth-context';
import { appAuth, syncActorOf } from '@libs/auth-shared-ts/auth-context';
import { ANON_ID_HEADER } from '@libs/auth-shared-ts/session-middleware';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { AuthErrorBody } from '@pkgs/sync-engine-shared-ts/v2';
import { isUuid } from '@pkgs/uuid-shared-ts/uuid';

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
  const deviceId = request.headers.get(ANON_ID_HEADER)?.trim();
  if (!isUuid(deviceId)) return { error: 'auth', reason: 'expired' };
  // The auth port returns an empty context for an invalid session. A thrown
  // storage/provider error is not evidence that credentials expired: let the
  // server report a retryable failure without telling the client to sign out.
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
}
