import { ApiClientProvider } from '../api/api-context';
import { createApiClient } from '../api/hc';
import { useConfigService } from '@gamezilla/auth/client/config-service-context';
import { useMemo, type ReactNode } from 'react';

export function ApiClientProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const config = useConfigService();
  const apiClient = useMemo(
    () => createApiClient(config.getApiUrl()),
    [config]
  );

  return <ApiClientProvider value={apiClient}>{children}</ApiClientProvider>;
}
