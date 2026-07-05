import { useConfigService } from '@libs/auth/client/config-service-context';
import { isLocalApiOrigin } from '@libs/auth/shared/local-api-origin';
import { ObservabilityProvider as BaseObservabilityProvider } from '@pkgs/observability/client/observability-provider';
import { useMemo, type ReactNode } from 'react';

export function AppObservability({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const config = useConfigService();
  const forceNoop = useMemo(
    () => !isLocalApiOrigin(config.getApiUrl()),
    [config]
  );
  return (
    <BaseObservabilityProvider
      serviceName={'gamezilla-client' as const}
      backendEnv={process.env['EXPO_PUBLIC_OBSERVABILITY_BACKEND']}
      forceNoop={forceNoop}
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
