import { useWatchValue } from '@pkgs/sync-engine/client/sync-engine-context';

import { AccountProviderCol, ACCOUNT_PROVIDERS_TABLE } from '../shared/auth-tables';

export const AccountProviderField = {
  id: 'id',
  accountId: 'accountId',
  provider: 'provider',
  providerUserId: 'providerUserId',
  email: 'email',
  linkedAt: 'linkedAt',
} as const satisfies Record<string, keyof typeof AccountProviderCol>;

export type AccountProviderFieldKey = keyof typeof AccountProviderField;

export function useAccountProviderColumn(
  providerId: string,
  field: AccountProviderFieldKey
): string | null {
  const col = AccountProviderCol[field];
  const { value } = useWatchValue<string>(
    `SELECT ${col} AS value FROM ${ACCOUNT_PROVIDERS_TABLE.tableName} WHERE ${AccountProviderCol.id} = ?`,
    [providerId]
  );
  return value;
}
