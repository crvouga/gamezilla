import { useClientEnv } from '@apps/client/product/client-env-provider';
import { type ReactNode, useMemo } from 'react';
import { ApiClientProvider } from '../../api/api-context';
import { createApiClient } from '../../api/hc';

export function AppApiClient({ children }: { children: ReactNode }): ReactNode {
  const env = useClientEnv();
  const apiClient = useMemo(
    () =>
      createApiClient(env.serverUrl, {
        fetch: (input, init) => env.server(input, init),
      }),
    [env]
  );

  return <ApiClientProvider value={apiClient}>{children}</ApiClientProvider>;
}
