import { ConfigServiceProvider } from '@libs/auth/client/config-service-context';
import { type ReactNode, useMemo } from 'react';
import { createConfigService } from '../../config/create-config-service';

export function AppConfigService({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const config = useMemo(() => createConfigService(), []);
  return (
    <ConfigServiceProvider value={config}>{children}</ConfigServiceProvider>
  );
}
