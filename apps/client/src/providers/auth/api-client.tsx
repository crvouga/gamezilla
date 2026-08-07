import { useConfigService } from '@libs/auth/client/config-service-context';
import { type ReactNode, useMemo } from 'react';
import { ApiClientProvider } from '../../api/api-context';
import { createApiClient } from '../../api/hc';

export function AppApiClient({ children }: { children: ReactNode }): ReactNode {
  const config = useConfigService();
  const apiClient = useMemo(
    () => createApiClient(config.getApiUrl()),
    [config]
  );

  return <ApiClientProvider value={apiClient}>{children}</ApiClientProvider>;
}
