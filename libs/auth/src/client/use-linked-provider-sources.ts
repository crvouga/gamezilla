import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TABLE,
  ENTITY_STORE_TYPE_USER,
} from '@libs/db/shared/entity-store-table';
import { sqlMap } from '@pkgs/sql-map';

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
        ? sqlMap({
            select: [
              [ExternalAccountCol.externalId, 'external_id'],
              [ExternalAccountCol.metadata, 'metadata'],
              [ExternalAccountCol.createdAt, 'created_at'],
            ],
            from: EXTERNAL_ACCOUNTS_TABLE,
            where: ['=', 1, 0],
          })
        : sqlMap({
            select: [
              [ExternalAccountCol.externalId, 'external_id'],
              [ExternalAccountCol.metadata, 'metadata'],
              [ExternalAccountCol.createdAt, 'created_at'],
            ],
            from: EXTERNAL_ACCOUNTS_TABLE,
            where: [
              'and',
              ['=', ExternalAccountCol.userId, accountId],
              ['=', ExternalAccountCol.provider, primaryAuthProvider],
            ],
            limit: 1,
          })
    );

  const { row: entityRow } = useWatchOne<AuthEntityStoreRow>(
    accountId === null
      ? sqlMap({
          select: ['data', 'created_at'],
          from: ENTITY_STORE_TABLE,
          where: ['=', 1, 0],
        })
      : sqlMap({
          select: ['data', 'created_at'],
          from: ENTITY_STORE_TABLE,
          where: [
            'and',
            ['=', 'namespace', ENTITY_STORE_NAMESPACE_AUTH],
            ['=', 'type', ENTITY_STORE_TYPE_USER],
            ['=', 'owner_id', accountId],
          ],
          limit: 1,
        })
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
