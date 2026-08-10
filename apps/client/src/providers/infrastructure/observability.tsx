import { ObservabilityProvider as BaseObservabilityProvider } from '@pkgs/observability/client/observability-provider';
import type { ReactNode } from 'react';

/**
 * Pre-sync observability: always noop. Real backend mounts after sync via
 * {@link AppObservabilityFromClientConfig}.
 */
export function AppObservability({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <BaseObservabilityProvider
      serviceName={'gamezilla-client' as const}
      backendEnv="noop"
      forceNoop
    >
      {children}
    </BaseObservabilityProvider>
  );
}
