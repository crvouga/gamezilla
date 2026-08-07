import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TYPE_USER,
} from '@libs/db/shared/entity-store-table';
import { sql } from '@pkgs/sql';

import { useQueryOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useSyncEnginePaintReady } from '@pkgs/sync-engine/client/sync-engine-paint-gate';
import { useMemo } from 'react';

import {
  buildLinkedProviders,
  type LinkedProviderSources,
  parseEntityStoreData,
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
  const paintReady = useSyncEnginePaintReady();
  const { providerLabel: primaryAuthProvider } = useAuthClientPort();
  const scopedAccountId = paintReady ? accountId : null;
  const { row: authExternalAccountRow } =
    useQueryOne(sql<PrimaryAuthExternalAccountRow>`
      SELECT external_id, metadata, created_at
      FROM external_accounts
      WHERE user_id = ${scopedAccountId}
        AND provider = ${primaryAuthProvider}
      LIMIT 1
    `);

  const { row: entityRow } = useQueryOne(sql<AuthEntityStoreRow>`
    SELECT data, created_at
    FROM entity_store
    WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH}
      AND type = ${ENTITY_STORE_TYPE_USER}
      AND owner_id = ${scopedAccountId}
    LIMIT 1
  `);

  return useMemo((): LinkedProviderSources | null => {
    if (!paintReady || accountId === null) return null;
    return buildSourcesFromRows({
      accountId,
      primaryAuthProvider,
      authExternalAccountRow,
      entityRow,
    });
  }, [
    paintReady,
    accountId,
    primaryAuthProvider,
    authExternalAccountRow,
    entityRow,
  ]);
}

export function useLinkedProviders(accountId: string | null) {
  const sources = useLinkedProviderSources(accountId);
  return useMemo(
    () => (sources === null ? [] : buildLinkedProviders(sources)),
    [sources]
  );
}
