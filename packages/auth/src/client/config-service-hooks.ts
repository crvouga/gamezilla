import { useMemo } from 'react';

import { useClientStore } from './client-store-context';

export function useConfigService() {
  const store = useClientStore();
  return useMemo(() => store.getConfigService(), [store]);
}
