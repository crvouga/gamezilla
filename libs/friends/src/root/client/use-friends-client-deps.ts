import { useConfigService } from '@libs/auth/client/config-service-context';
import { useClientRequestAuth } from '@libs/auth/client/use-client-request-auth';
import { useHttpClient } from '@pkgs/http-client';
import { useMemo } from 'react';

import type { FriendsClientDeps } from './friends-client-deps';

export function useFriendsClientDeps(): FriendsClientDeps {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const { fetch: fetchFn } = useHttpClient();
  return useMemo(
    () => ({
      config,
      fetchFn,
      auth,
    }),
    [config, auth, fetchFn]
  );
}
