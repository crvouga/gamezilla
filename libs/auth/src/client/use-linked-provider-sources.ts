import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TYPE_USER,
} from '@libs/db/shared/entity-store-table';
import { sql } from '@pkgs/sql';

import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import {
  buildLinkedProviders,
  parseEntityStoreData,
  type LinkedProviderSources,
} from '../shared/linked-account-providers';
import { useAuthClientPort } from './auth-client-provider';

type PrimaryAuthExternalAccountRow = {
  readonly external_id: string | null;
  readonly metadata: unknown;
  readonly created_at: string | null;
};

type AuthEntityStoreRow = {
  readonly data: unknown;
  readonly created_at: string | null;
};

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function buildSourcesFromRows(args: {
  readonly accountId: string;
  readonly primaryAuthProvider: string;
  readonly authExternalAccountRow:
    | PrimaryAuthExternalAccountRow
    | null
    | undefined;
  readonly entityRow: AuthEntityStoreRow | null | undefined;
}): LinkedProviderSources | null {
  const externalId = readNonEmptyString(
    args.authExternalAccountRow?.external_id
  );
  if (externalId === null) return null;

  const authCreatedAt = readNonEmptyString(
    args.authExternalAccountRow?.created_at
  );
  const entityCreatedAt = readNonEmptyString(args.entityRow?.created_at);
  return {
    accountId: args.accountId,
    primaryAuthProvider: args.primaryAuthProvider,
    primaryAuthExternalAccount: {
      externalId,
      metadata: args.authExternalAccountRow?.metadata ?? null,
      createdAt: authCreatedAt ?? new Date(0).toISOString(),
    },
    authSnapshotData: parseEntityStoreData(args.entityRow?.data),
    entityCreatedAt,
  };
}

export function useLinkedProviderSources(
  accountId: string | null
): LinkedProviderSources | null {
  const { providerLabel: primaryAuthProvider } = useAuthClientPort();
  const { row: authExternalAccountRow } =
    useWatchOne(sql<PrimaryAuthExternalAccountRow>`
      SELECT external_id, metadata, created_at
      FROM external_accounts
      WHERE user_id = ${accountId}
        AND provider = ${primaryAuthProvider}
      LIMIT 1
    `);

  const { row: entityRow } = useWatchOne(sql<AuthEntityStoreRow>`
    SELECT data, created_at
    FROM entity_store
    WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH}
      AND type = ${ENTITY_STORE_TYPE_USER}
      AND owner_id = ${accountId}
    LIMIT 1
  `);

  return useMemo((): LinkedProviderSources | null => {
    if (accountId === null) return null;
    return buildSourcesFromRows({
      accountId,
      primaryAuthProvider,
      authExternalAccountRow,
      entityRow,
    });
  }, [accountId, primaryAuthProvider, authExternalAccountRow, entityRow]);
}

export function useLinkedProviders(accountId: string | null) {
  const sources = useLinkedProviderSources(accountId);
  return useMemo(
    () => (sources === null ? [] : buildLinkedProviders(sources)),
    [sources]
  );
}
