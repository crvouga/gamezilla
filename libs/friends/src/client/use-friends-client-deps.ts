import { useConfigService } from '@libs/auth/client/config-service-context';
import { useClientRequestAuth } from '@libs/auth/client/use-client-request-auth';
import { useMemo } from 'react';

import type { FriendsClientDeps } from './friends-client-deps';

export function useFriendsClientDeps(): FriendsClientDeps {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  return useMemo(
    () => ({
      config,
      fetchFn: fetch.bind(globalThis),
      auth,
    }),
    [config, auth]
  );
}
