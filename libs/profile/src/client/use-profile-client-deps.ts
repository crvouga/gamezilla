import { useConfigService } from '@libs/auth/client/config-service-context';
import { useClientRequestAuth } from '@libs/auth/client/use-client-request-auth';

import type { ProfileClientDeps } from './profile-api';

export function useProfileClientDeps(): ProfileClientDeps {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  return { config, fetchFn: globalThis.fetch.bind(globalThis), auth };
}
