import { useConfigService } from '@libs/auth/client/config-service-context';
import { useIo } from '@pkgs/io';
import { type ReactNode, useMemo } from 'react';
import { ApiClientProvider } from '../../api/api-context';
import { createApiClient } from '../../api/hc';

export function AppApiClient({ children }: { children: ReactNode }): ReactNode {
  const config = useConfigService();
  const io = useIo();
  const apiClient = useMemo(
    () =>
      createApiClient(config.getApiUrl(), {
        fetch: (input, init) => io.http.fetch(input, init),
      }),
    [config, io.http]
  );

  return <ApiClientProvider value={apiClient}>{children}</ApiClientProvider>;
}
