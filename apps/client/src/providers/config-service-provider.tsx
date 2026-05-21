import { ConfigServiceProvider } from '@libs/auth/client/config-service-context';
import { createConfigService } from '../config/create-config-service';
import { useMemo, type ReactNode } from 'react';

export function ConfigServiceProviderWrapper({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const config = useMemo(() => createConfigService(), []);
  return (
    <ConfigServiceProvider value={config}>{children}</ConfigServiceProvider>
  );
}
