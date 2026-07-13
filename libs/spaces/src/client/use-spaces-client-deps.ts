import { useConfigService } from '@libs/auth/client/config-service-context';
import { useMemo } from 'react';

import type { SpacesClientDeps } from './spaces-actions';

export function useSpacesClientDeps(): SpacesClientDeps {
  const config = useConfigService();
  return useMemo(
    () => ({
      config,
      fetchFn: fetch.bind(globalThis),
    }),
    [config]
  );
}
