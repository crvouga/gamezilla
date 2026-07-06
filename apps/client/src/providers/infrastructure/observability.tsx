import { ObservabilityProvider as BaseObservabilityProvider } from '@pkgs/observability/client/observability-provider';
import { type ReactNode } from 'react';

export function AppObservability({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <BaseObservabilityProvider
      serviceName={'gamezilla-client' as const}
      backendEnv={process.env['EXPO_PUBLIC_OBSERVABILITY_BACKEND']}
      {...(process.env['EXPO_PUBLIC_OBSERVABILITY_COLLECTOR_URL'] !== undefined
        ? {
            collectorUrl:
              process.env['EXPO_PUBLIC_OBSERVABILITY_COLLECTOR_URL'],
          }
        : {})}
    >
      {children}
    </BaseObservabilityProvider>
  );
}
