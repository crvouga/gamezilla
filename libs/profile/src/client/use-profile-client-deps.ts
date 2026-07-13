import { useConfigService } from '@libs/auth/client/config-service-context';

import type { ProfileClientDeps } from './profile-online-actions';

export function useProfileClientDeps(): ProfileClientDeps {
  const config = useConfigService();
  return { config, fetchFn: fetch };
}
