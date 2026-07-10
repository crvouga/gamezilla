import { useMemo } from 'react';

import { useLinkedProviders } from './use-linked-provider-sources';

/**
 * Linked provider row ids for the given account, or `[]` while signed out.
 */
export function useLinkedProviderEntityIds(accountId: string | null): string[] {
  const providers = useLinkedProviders(accountId);
  return useMemo(() => providers.map((row) => row.id), [providers]);
}
