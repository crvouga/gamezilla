import { useClientConfig } from '@libs/client-config/client/use-client-config';
import { ObservabilityProvider as BaseObservabilityProvider } from '@pkgs/observability/client/observability-provider';
import type { ReactNode } from 'react';

/**
 * Observability from synced `client_config` (after sync paint).
 * Defaults to noop until rows exist.
 */
export function AppObservabilityFromClientConfig({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { config } = useClientConfig();
  const backend = config.observability_backend;

  return (
    <BaseObservabilityProvider
      serviceName={'gamezilla-client' as const}
      backendEnv={backend}
    >
      {children}
    </BaseObservabilityProvider>
  );
}
