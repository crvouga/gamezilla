import { createSecureStorageItem } from '@pkgs/secure-storage/solid';
import { sql } from '@pkgs/sql';

import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';
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
  const userRows = createQuery(
    () => sql<UserRow>`
    SELECT created_at, is_anon
    FROM auth_users
    WHERE id = ${userId()}
  `
  );
  const userRow = createMemo(() => userRows.rows()[0] ?? null);
  const billingRows = createQuery(
    () => sql<BillingLinkRow>`
    SELECT external_id
    FROM auth_external_accounts
    WHERE user_id = ${userId()}
      AND provider = ${EXTERNAL_ACCOUNT_PROVIDER_BILLING}
  `
  );
  const billingRow = createMemo(() => billingRows.rows()[0] ?? null);

  const isAnon = createMemo(
    () =>
      !hasSession() &&
      (userRow() === null ? true : readIsAnonFlag(userRow()?.is_anon))
  );

  return {
    get id() {
      return userId();
    },
    get isAnon() {
      return isAnon();
    },
    get createdAt() {
      return userRow()?.created_at ?? null;
    },
    get billingCustomerId() {
      return billingRow()?.external_id ?? null;
    },
  };
}

/**
 * `true` when bound to a non-anon user with a session token.
 */
export function useIsSignedIn(): Accessor<boolean> {
  const accountId = useCurrentAccountId();
  const token = useFreshAuthToken();
  const isAnon = useIsAnon();
  return createMemo(() => resolveIsSignedIn(accountId(), token(), isAnon()));
}

/**
 * Local-first provider session: hydrated secure storage has a bearer.
 * Does not wait on IdP `useSession`.
 */
export function useHasAuthSession(): Accessor<boolean> {
  const item = createSecureStorageItem(SESSION_TOKEN_KEY);
  return createMemo(() => {
    const value = item.value();
    const token = typeof value === 'string' && value.length > 0 ? value : null;
    return resolveHasAuthSession({
      storageHydrated: item.isHydrated(),
      sessionToken: token,
    });
  });
}

/**
 * Replication / profile identity: `users.id` from secure storage.
 * Empty string only before anon ensure writes `currentUserId`.
 */
export function useMyId(): Accessor<string> {
  const accountId = useCurrentAccountId();
  return createMemo(() => resolveMyId(accountId()));
}

/** Same as {@link useMyId} when bound; `null` before anon ensure. */
export function useMyAccountId(): Accessor<string | null> {
  return useCurrentAccountId();
}

/**
 * `true` when the active `users` row is anon (no provider session / link).
 */
export function useIsAnon(): Accessor<boolean> {
  const hasSession = useHasAuthSession();
  const myId = useMyId();
  const watchId = createMemo(() => {
    const id = myId();
    return id.length > 0 ? id : '';
  });
  const rows = createQuery(
    () => sql<{ is_anon: number | boolean | null }>`
    SELECT is_anon
    FROM auth_users
    WHERE id = ${watchId()}
  `
  );
  const row = createMemo(() => rows.rows()[0] ?? null);
  return createMemo(() => {
    if (hasSession()) return false;
    const id = myId();
    if (id.length === 0) return true;
    const current = row();
    if (current === null) return true;
    return readIsAnonFlag(current.is_anon);
  });
}

/**
 * Stable install device id (`devices.id`). Not a user/profile identity.
 */
export function useMyDeviceId(): Accessor<string> {
  const id = useDeviceId();
  return createMemo(() => id() ?? '');
}

/**
 * Email for the primary auth-provider link from synced
 * `auth_external_accounts.metadata` (written by `/identity/refresh`).
 */
export function useSessionAccountEmail(): Accessor<string | null> {
  const hasSession = useHasAuthSession();
  const userId = useMyId();
  const provider = useAuthClientPort().providerLabel;
  const watchId = createMemo(() =>
    hasSession() && userId().length > 0 ? userId() : ''
  );
  const rows = createQuery(
    () => sql<ExternalAccountRow>`
    SELECT metadata
    FROM auth_external_accounts
    WHERE user_id = ${watchId()}
      AND provider = ${provider}
    LIMIT 1
  `
  );
  const row = createMemo(() => rows.rows()[0] ?? null);
  return createMemo(() => {
    const current = row();
    if (current === null) return null;
    return parseMetadataEmail(current.metadata);
  });
}
