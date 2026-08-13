import { ConfigServiceProvider } from '@libs/auth/client/config-service-context';
import { type ReactNode, useMemo } from 'react';
import { createConfigService } from '../../config/create-config-service';
import { useClientSystemResources } from '../client-system-resources';

export function AppConfigService({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { apiUrl } = useClientSystemResources();
  const config = useMemo(
    () => createConfigService(apiUrl === undefined ? {} : { apiUrl }),
    [apiUrl]
  );
  return (
    <ConfigServiceProvider value={config}>{children}</ConfigServiceProvider>
  );
}
