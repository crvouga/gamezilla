import { useHydratedSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import { sql } from '@pkgs/sql';

import { useQuery } from '@pkgs/sync-engine/client';
import { useAuthClientPort } from './auth-client-provider';
import { SESSION_TOKEN_KEY } from './auth-storage-keys';
import { EXTERNAL_ACCOUNT_PROVIDER_BILLING } from './external-account-providers';
import { parseMetadataEmail } from './linked-account-providers';
import { resolveIsSignedIn, resolveMyId } from './resolve-client-identity';
import { resolveHasAuthSession } from './session-capability';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { useFreshAuthToken } from './use-fresh-auth-token';

export type CurrentUser = {
  /** `users.id` — always set after anon ensure / auth refresh. */
  readonly id: string;
  readonly isAnon: boolean;
  readonly createdAt: string | null;
  readonly billingCustomerId: string | null;
};

type UserRow = {
  readonly created_at: string | null;
  readonly is_anon: number | boolean | string | null;
};

type BillingLinkRow = {
  readonly external_id: string | null;
};

type ExternalAccountRow = {
  readonly metadata: unknown;
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
    FROM auth_users
    WHERE id = ${userId}
  `);
  const userRow = userRows[0] ?? null;
  const { rows: billingRows } = useQuery(sql<BillingLinkRow>`
    SELECT external_id
    FROM auth_external_accounts
    WHERE user_id = ${userId}
      AND provider = ${EXTERNAL_ACCOUNT_PROVIDER_BILLING}
  `);
  const billingRow = billingRows[0] ?? null;

  const isAnon =
    !hasSession && (userRow === null ? true : readIsAnonFlag(userRow.is_anon));

  return {
    id: userId,
    isAnon,
    createdAt: userRow?.created_at ?? null,
    billingCustomerId: billingRow?.external_id ?? null,
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
 * Local-first provider session: hydrated secure storage has a bearer.
 * Does not wait on Better Auth `useSession`.
 */
export function useHasAuthSession(): boolean {
  const { value, isHydrated } = useHydratedSecureStorageItem(SESSION_TOKEN_KEY);
  const token = typeof value === 'string' && value.length > 0 ? value : null;
  return resolveHasAuthSession({
    storageHydrated: isHydrated,
    sessionToken: token,
  });
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
    FROM auth_users
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

/**
 * Email for the primary auth-provider link from synced
 * `auth_external_accounts.metadata` (written by `/identity/refresh`).
 */
export function useSessionAccountEmail(): string | null {
  const hasSession = useHasAuthSession();
  const userId = useMyId();
  const provider = useAuthClientPort().providerLabel;
  const watchId = hasSession && userId.length > 0 ? userId : '';
  const { rows } = useQuery(sql<ExternalAccountRow>`
    SELECT metadata
    FROM auth_external_accounts
    WHERE user_id = ${watchId}
      AND provider = ${provider}
    LIMIT 1
  `);
  const row = rows[0] ?? null;
  if (row === null) return null;
  return parseMetadataEmail(row.metadata);
}
