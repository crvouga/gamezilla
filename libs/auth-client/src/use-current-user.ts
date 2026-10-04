import sql from '@pkgs/sql-shared/sql';

import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';
import { useHasAuthSession } from './access-facts';
import { useAuthClientPort } from './auth-client-provider';
import { BILLING_CUSTOMER_LINK_PREFIX } from '@libs/auth-shared/external-account-providers';
import { parseMetadataEmail } from '@libs/auth-shared/linked-account-providers';
import { resolveMyId } from '@libs/auth-shared/resolve-client-identity';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';

export type CurrentUser = {
  /** `users.id` — always set after anon ensure / auth refresh. */
  readonly id: string;
  readonly createdAt: string | null;
  readonly billingCustomerId: string | null;
};

type UserRow = {
  readonly created_at: string | null;
};

type BillingLinkRow = {
  readonly external_id: string | null;
};

type ExternalAccountRow = {
  readonly metadata: unknown;
};

/**
 * Source of truth for "who am I" on the client. Always a real `users` row
 * after auth boot (anon or signed-in). Returns a stub while the `users` row
 * is still syncing.
 *
 * Call only under SyncEngine + after `currentUserId` is bound (anon ensure).
 */
export function useCurrentUser(): CurrentUser {
  const userId = useMyId();
  const userRows = createQuery(
    () => sql<UserRow>`
    SELECT created_at
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
      AND provider LIKE ${`${BILLING_CUSTOMER_LINK_PREFIX}%`}
    ORDER BY updated_at DESC
  `
  );
  const billingRow = createMemo(() => billingRows.rows()[0] ?? null);

  return {
    get id() {
      return userId();
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
  const provider = useAuthClientPort().provider;
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
