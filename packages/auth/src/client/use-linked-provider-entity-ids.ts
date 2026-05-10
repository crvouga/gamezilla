import { ACCOUNT_PROVIDER_ENTITY_TYPE, AccountProviderAttr } from '../shared';
import { useQueryEntityIds } from '@gamezilla/patch-db/react';

/**
 * Account-provider entity ids for the given account, or `[]` while signed
 * out. Atoms iterate these ids and read each provider's attributes via
 * `useQueryAttribute` inline.
 */
export function useLinkedProviderEntityIds(accountId: string | null): string[] {
  const args: Parameters<typeof useQueryEntityIds>[0] =
    accountId === null
      ? { entityType: ACCOUNT_PROVIDER_ENTITY_TYPE, limit: 0 }
      : {
          entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
          where: {
            type: '=' as const,
            attribute: AccountProviderAttr.accountId.key,
            value: accountId,
          },
        };
  return useQueryEntityIds(args);
}
