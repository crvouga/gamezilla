import { useConfigService } from '@libs/auth/client/config-service-context';
import { useMemo } from 'react';

import type { FriendsClientDeps } from './search-users/search-users';

export function useFriendsClientDeps(): FriendsClientDeps {
  const config = useConfigService();
  return useMemo(
    () => ({
      config,
      fetchFn: fetch.bind(globalThis),
    }),
    [config]
  );
}
