import { useEntity } from '@gamezilla/patch-db/react';

import { ACCOUNT_ENTITY_TYPE, AccountAttr } from '../shared';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { useSessionToken } from './use-session-token';

export type CurrentUser = {
  accountId: string;
  createdAt: string | null;
  stripeCustomerId: string | null;
};

/**
 * Source of truth for "who is signed in" on the client. Reads:
 *   - `accountId` from secure storage (instant, survives cold start)
 *   - the `account/<id>` entity from PatchDB (populated by the most recent
 *     `POST /auth/refresh`, replicated and persisted in local SQLite)
 *
 * Returns `null` when signed out. Returns a stub `{ accountId, ... }` while
 * the PatchDB row is still syncing; consumers can render their UI off the
 * non-null `accountId` and let attribute reads fill in over time.
 */
export function useCurrentUser(): CurrentUser | null {
  const accountId = useCurrentAccountId();
  const entity = useEntity(ACCOUNT_ENTITY_TYPE, accountId ?? '');
  if (accountId === null) return null;

  const attrs = entity?.attributes ?? {};
  const createdAtRaw = attrs[AccountAttr.createdAt.key];
  const stripeCustomerIdRaw = attrs[AccountAttr.stripeCustomerId.key];
  return {
    accountId,
    createdAt: typeof createdAtRaw === 'string' ? createdAtRaw : null,
    stripeCustomerId:
      typeof stripeCustomerIdRaw === 'string' ? stripeCustomerIdRaw : null,
  };
}

/**
 * Convenience: `true` iff a session token + account id are both present in
 * secure storage. The PatchDB account row is irrelevant — sign-in is effective
 * the moment `<AuthBridge>` writes both keys.
 */
export function useIsSignedIn(): boolean {
  const accountId = useCurrentAccountId();
  const token = useSessionToken();
  return accountId !== null && token !== null;
}

/**
 * Replication identity for patch metadata: account id when signed in, else the
 * install device id. Returns the empty string only on first cold start before
 * the device id has been generated (vanishingly small window).
 */
export function useMyId(): string {
  const accountId = useCurrentAccountId();
  const deviceId = useDeviceId();
  if (accountId !== null) return accountId;
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
