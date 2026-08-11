import { appAuth } from '@libs/auth/shared/auth-context';
import { assert } from '@pkgs/assert';
import { isAuthErrorBody } from '@pkgs/sync-engine/server';
import type { AuthErrorBody } from '@pkgs/sync-engine/shared';

import { apiRequestAsyncLocalStorage } from '../request-scope';

export type SessionReplayAuth = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

export { isAuthErrorBody };

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
    const auth = appAuth(ctx);
    if (auth === null || auth.deviceId === '' || auth.myId.length === 0) {
      return { error: 'auth', reason: 'expired' };
    }
    return {
      actorId: auth.myId,
      deviceId: auth.deviceId,
      accountId: auth.accountId,
      isAnon: auth.isAnon,
    };
  } catch {
    return { error: 'auth', reason: 'expired' };
  }
}
