import { useMemo } from 'react';

import {
  type LinkedProviderField,
  readLinkedProviderField,
} from '../shared/linked-account-providers';
import { useLinkedProviderSources } from './use-linked-provider-sources';

export const AccountProviderField = {
  id: 'id',
  accountId: 'accountId',
  provider: 'provider',
  providerUserId: 'providerUserId',
  email: 'email',
  linkedAt: 'linkedAt',
} as const satisfies Record<string, LinkedProviderField>;

export type AccountProviderFieldKey = keyof typeof AccountProviderField;

export function useAccountProviderColumn(
  providerId: string,
  field: AccountProviderFieldKey
): string | null {
  const accountId = useMemo(() => {
    const firstColon = providerId.indexOf(':');
    return firstColon > 0 ? providerId.slice(0, firstColon) : null;
  }, [providerId]);
  const sources = useLinkedProviderSources(accountId);
  return useMemo(() => {
    if (sources === null) return null;
    return readLinkedProviderField(
      providerId,
      AccountProviderField[field],
      sources
    );
  }, [providerId, field, sources]);
}
