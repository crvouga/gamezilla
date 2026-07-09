import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';

import { AccountCol, ACCOUNTS_TABLE } from '../shared/auth-tables';
import { useAuthClientPort } from './auth-client-provider';
import {
  useCurrentAccountId,
  getCachedCurrentAccountId,
} from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { useFreshAuthToken } from './use-fresh-auth-token';
import { isAuthSessionSignedIn } from './session-snapshot';

export type CurrentUser = {
  accountId: string;
  createdAt: string | null;
  stripeCustomerId: string | null;
};

type AccountRow = {
  readonly created_at: string | null;
  readonly stripe_customer_id: string | null;
};

/**
 * Source of truth for "who is signed in" on the client. Reads:
 *   - `accountId` from secure storage (instant, survives cold start)
 *   - the `accounts` row from local sync (populated by the most recent
 *     `POST /auth/refresh`, replicated via PowerSync)
 *
 * Returns `null` when signed out. Returns a stub `{ accountId, ... }` while
 * the row is still syncing; consumers can render off the non-null `accountId`
 * and let column reads fill in over time.
 */
export function useCurrentUser(): CurrentUser | null {
  const accountId = useCurrentAccountId();
  const { row } = useWatchOne<AccountRow>(
    `SELECT ${AccountCol.createdAt}, ${AccountCol.stripeCustomerId}
     FROM ${ACCOUNTS_TABLE.tableName}
     WHERE ${AccountCol.id} = ?`,
    accountId === null ? [''] : [accountId]
  );
  if (accountId === null) return null;

  return {
    accountId,
    createdAt: row?.created_at ?? null,
    stripeCustomerId: row?.stripe_customer_id ?? null,
  };
}

/**
 * Convenience: `true` iff a session token + account id are both present in
 * secure storage.
 */
export function useIsSignedIn(): boolean {
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const accountId = useCurrentAccountId();
  const token = useFreshAuthToken();

  if (isAuthSessionSignedIn(authState)) return true;

  return accountId !== null && token !== null;
}

/**
 * Replication identity: account id when signed in, else the install device id.
 */
export function useMyId(): string {
  const accountId = useCurrentAccountId();
  const deviceId = useDeviceId();
  const token = useFreshAuthToken();
  if (accountId !== null) return accountId;
  if (token !== null) {
    const cachedAccountId = getCachedCurrentAccountId();
    if (cachedAccountId !== null) return cachedAccountId;
  }
  return deviceId ?? '';
}

/** Account id for the current session, or `null` if signed out. */
export function useMyAccountId(): string | null {
  return useCurrentAccountId();
}

/**
 * Stable device id for the current install. Crashes if called before the
 * cold-start UUID write has completed; mount `<DeviceIdReady>` near the app
 * root if you need to gate render until then.
 */
export function useMyDeviceId(): string {
  const id = useDeviceId();
  return id ?? '';
}
