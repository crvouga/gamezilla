import { ConfigServiceProvider } from '@libs/auth/client/config-service-context';
import { type ReactNode, useMemo } from 'react';
import { createConfigService } from '../../config/create-config-service';
import { useAppOverrides } from '../app-overrides';

export function AppConfigService({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { apiUrl } = useAppOverrides();
  const config = useMemo(
    () => createConfigService(apiUrl === undefined ? {} : { apiUrl }),
    [apiUrl]
  );
  return (
    <ConfigServiceProvider value={config}>{children}</ConfigServiceProvider>
  );
}
