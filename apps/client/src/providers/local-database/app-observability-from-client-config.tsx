import { useClientConfig } from '@libs/client-config/client/use-client-config';
import { ObservabilityProvider as BaseObservabilityProvider } from '@pkgs/observability/client/observability-provider';
import { initClientSentry } from '@pkgs/observability/impl-sentry/init-client-sentry';
import type { ReactNode } from 'react';

/**
 * Observability + Sentry from synced `client_config` (after sync paint).
 * Defaults to noop until rows exist.
 */
export function AppObservabilityFromClientConfig({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { config } = useClientConfig();
  const backend = config.observability_backend;
  const dsn = config.sentry_dsn;

  initClientSentry({ backend, dsn });

  return (
    <BaseObservabilityProvider
      serviceName={'gamezilla-client' as const}
      backendEnv={backend}
    >
      {children}
    </BaseObservabilityProvider>
  );
}
