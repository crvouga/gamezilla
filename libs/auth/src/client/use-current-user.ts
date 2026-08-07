import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client';

import { EXTERNAL_ACCOUNT_PROVIDER_STRIPE } from '../shared/external-account-providers';
import { useAuthClientPort } from './auth-client-provider';
import { resolveIsSignedIn, resolveMyId } from './resolve-client-identity';
import { isAuthSessionSignedIn } from './session-snapshot';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { useFreshAuthToken } from './use-fresh-auth-token';

export type CurrentUser = {
  /** `users.id` — always set after anon ensure / auth refresh. */
  readonly id: string;
  readonly isAnon: boolean;
  readonly createdAt: string | null;
  readonly stripeCustomerId: string | null;
};

type UserRow = {
  readonly created_at: string | null;
  readonly is_anon: number | boolean | string | null;
};

type StripeLinkRow = {
  readonly external_id: string | null;
};

function readIsAnonFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't';
}

/**
 * Source of truth for "who am I" on the client. Always a real `users` row
 * after auth boot (anon or signed-in). Returns a stub while the `users` row
 * is still syncing.
 *
 * Call only under SyncEngine + after `currentUserId` is bound (anon ensure).
 */
export function useCurrentUser(): CurrentUser {
  const userId = useMyId();
  const hasSession = useHasAuthSession();
  const { rows: userRows } = useQuery(sql<UserRow>`
    SELECT created_at, is_anon
    FROM users
    WHERE id = ${userId}
  `);
  const userRow = userRows[0] ?? null;
  const { rows: stripeRows } = useQuery(sql<StripeLinkRow>`
    SELECT external_id
    FROM external_accounts
    WHERE user_id = ${userId}
      AND provider = ${EXTERNAL_ACCOUNT_PROVIDER_STRIPE}
  `);
  const stripeRow = stripeRows[0] ?? null;

  const isAnon =
    !hasSession && (userRow === null ? true : readIsAnonFlag(userRow.is_anon));

  return {
    id: userId,
    isAnon,
    createdAt: userRow?.created_at ?? null,
    stripeCustomerId: stripeRow?.external_id ?? null,
  };
}

/**
 * `true` when bound to a non-anon user with a session token.
 */
export function useIsSignedIn(): boolean {
  const userId = useCurrentAccountId();
  const token = useFreshAuthToken();
  const isAnon = useIsAnon();
  return resolveIsSignedIn(userId, token, isAnon);
}

/**
 * Provider session hydrated and present (sign-in / sign-out chrome).
 */
export function useHasAuthSession(): boolean {
  const port = useAuthClientPort();
  return isAuthSessionSignedIn(port.useAuthSession());
}

/**
 * Replication / profile identity: `users.id` from secure storage.
 * Empty string only before anon ensure writes `currentUserId`.
 */
export function useMyId(): string {
  return resolveMyId(useCurrentAccountId());
}

/** Same as {@link useMyId} when bound; `null` before anon ensure. */
export function useMyAccountId(): string | null {
  return useCurrentAccountId();
}

/**
 * `true` when the active `users` row is anon (no provider session / link).
 */
export function useIsAnon(): boolean {
  const hasSession = useHasAuthSession();
  const myId = useMyId();
  const watchId = myId.length > 0 ? myId : '';
  const { rows } = useQuery(sql<{ is_anon: number | boolean | null }>`
    SELECT is_anon
    FROM users
    WHERE id = ${watchId}
  `);
  const row = rows[0] ?? null;
  if (hasSession) return false;
  if (myId.length === 0) return true;
  if (row === null) return true;
  return readIsAnonFlag(row.is_anon);
}

/**
 * Stable install device id (`devices.id`). Not a user/profile identity.
 */
export function useMyDeviceId(): string {
  const id = useDeviceId();
  return id ?? '';
}
