import { useClientEnv } from '@apps/client/product/client-env-provider';
import { ConfigServiceProvider } from '@libs/auth/public/config-service-context';
import { type ReactNode, useMemo } from 'react';
import { createConfigService } from '../../config/create-config-service';

export function AppConfigService({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { serverUrl } = useClientEnv();
  const config = useMemo(
    () => createConfigService({ apiUrl: serverUrl }),
    [serverUrl]
  );
  return (
    <ConfigServiceProvider value={config}>{children}</ConfigServiceProvider>
  );
}
