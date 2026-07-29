import { useConfigService } from '@libs/auth/client/config-service-context';
import { useMemo } from 'react';

import type { UserSearchClientDeps } from './search-users';

export function useUserSearchClientDeps(): UserSearchClientDeps {
  const config = useConfigService();
  return useMemo(
    () => ({
      config,
      fetchFn: fetch.bind(globalThis),
    }),
    [config]
  );
}
