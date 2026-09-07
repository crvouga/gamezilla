import { useConfigService } from '@libs/auth/public/config-service-context';
import { useClientRequestAuth } from '@libs/auth/public/use-client-request-auth';
import { useHttpClient } from '@pkgs/http-client/solid';

import type { FriendsClientDeps } from './friends-client-deps';

export function useFriendsClientDeps(): FriendsClientDeps {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const { fetch: fetchFn } = useHttpClient();
  return {
    config,
    fetchFn,
    auth,
  };
}
