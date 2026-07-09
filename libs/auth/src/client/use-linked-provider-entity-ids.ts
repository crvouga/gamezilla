import {
  AccountProviderCol,
  ACCOUNT_PROVIDERS_TABLE,
} from '../shared/auth-tables';
import { useWatchQuery } from '@pkgs/sync-engine/client/sync-engine-context';

type ProviderIdRow = {
  readonly id: string;
};

/**
 * Linked provider row ids for the given account, or `[]` while signed out.
 */
export function useLinkedProviderEntityIds(accountId: string | null): string[] {
  const { rows } = useWatchQuery<ProviderIdRow>(
    accountId === null
      ? `SELECT ${AccountProviderCol.id} AS id FROM ${ACCOUNT_PROVIDERS_TABLE.tableName} WHERE 0`
      : `SELECT ${AccountProviderCol.id} AS id
         FROM ${ACCOUNT_PROVIDERS_TABLE.tableName}
         WHERE ${AccountProviderCol.accountId} = ?`,
    accountId === null ? [] : [accountId]
  );
  return rows.map((row) => row.id);
}
