import { useConfigService } from '@libs/auth/public/config-service-context';
import { useClientRequestAuth } from '@libs/auth/public/use-client-request-auth';
import { useHttpClient } from '@pkgs/http-client/solid';

import type { UserSearchClientDeps } from './search-users';

export function useUserSearchClientDeps(): UserSearchClientDeps {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const { fetch: fetchFn } = useHttpClient();
  return { config, fetchFn, auth };
}
