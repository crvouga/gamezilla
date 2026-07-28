import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TABLE,
  ENTITY_STORE_TYPE_USER,
} from '@libs/db/shared/entity-store-table';
import { sql, ident } from '@pkgs/sql';
import { useWatchOne } from '@pkgs/sync-engine/client/sync-engine-context';
import { useMemo } from 'react';

import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
} from '@libs/db/shared/external-accounts-tables';
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
    useWatchOne<PrimaryAuthExternalAccountRow>(
      accountId === null
        ? sql`
            SELECT ${ident(ExternalAccountCol.externalId)} AS external_id,
                   ${ident(ExternalAccountCol.metadata)} AS metadata,
                   ${ident(ExternalAccountCol.createdAt)} AS created_at
            FROM ${ident(EXTERNAL_ACCOUNTS_TABLE)} WHERE 0
          `
        : sql`
            SELECT ${ident(ExternalAccountCol.externalId)} AS external_id,
                   ${ident(ExternalAccountCol.metadata)} AS metadata,
                   ${ident(ExternalAccountCol.createdAt)} AS created_at
            FROM ${ident(EXTERNAL_ACCOUNTS_TABLE)}
            WHERE ${ident(ExternalAccountCol.userId)} = ${accountId}
              AND ${ident(ExternalAccountCol.provider)} = ${primaryAuthProvider}
            LIMIT 1
          `
    );

  const { row: entityRow } = useWatchOne<AuthEntityStoreRow>(
    accountId === null
      ? sql`SELECT data, created_at FROM ${ident(ENTITY_STORE_TABLE)} WHERE 0`
      : sql`
          SELECT data, created_at FROM ${ident(ENTITY_STORE_TABLE)}
          WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH} AND type = ${ENTITY_STORE_TYPE_USER} AND owner_id = ${accountId}
          LIMIT 1
        `
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
