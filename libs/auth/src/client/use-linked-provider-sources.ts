import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TABLE,
  ENTITY_STORE_TYPE_USER,
} from '@libs/db/shared/entity-store-table';
import { useMemo } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
} from '@libs/db/shared/external-accounts-tables';
import {
  buildLinkedProviders,
  parseEntityStoreData,
  type LinkedProviderSources,
} from '../shared/linked-account-providers';

type PrimaryAuthExternalAccountRow = {
  readonly external_id: string | null;
  readonly metadata: unknown;
  readonly created_at: string | null;
};

type AuthEntityStoreRow = {
  readonly data: unknown;
  readonly created_at: string | null;
};

function readNonEmptyString(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
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
    useWatchOne<PrimaryAuthExternalAccountRow>(
      accountId === null
        ? `SELECT ${ExternalAccountCol.externalId} AS external_id,
                ${ExternalAccountCol.metadata} AS metadata,
                ${ExternalAccountCol.createdAt} AS created_at
         FROM ${EXTERNAL_ACCOUNTS_TABLE} WHERE 0`
        : `SELECT ${ExternalAccountCol.externalId} AS external_id,
                ${ExternalAccountCol.metadata} AS metadata,
                ${ExternalAccountCol.createdAt} AS created_at
         FROM ${EXTERNAL_ACCOUNTS_TABLE}
         WHERE ${ExternalAccountCol.userId} = ?
           AND ${ExternalAccountCol.provider} = ?
         LIMIT 1`,
      accountId === null ? [] : [accountId, primaryAuthProvider]
    );

  const { row: entityRow } = useWatchOne<AuthEntityStoreRow>(
    accountId === null
      ? `SELECT data, created_at FROM ${ENTITY_STORE_TABLE} WHERE 0`
      : `SELECT data, created_at FROM ${ENTITY_STORE_TABLE}
         WHERE namespace = ? AND type = ? AND owner_id = ?
         LIMIT 1`,
    accountId === null
      ? []
      : [ENTITY_STORE_NAMESPACE_AUTH, ENTITY_STORE_TYPE_USER, accountId]
  );

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
