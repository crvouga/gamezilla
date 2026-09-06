import { useClock } from '@pkgs/clock';
import { useCreateId } from '@pkgs/uuid';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { ObservabilityBackendFactory } from '../port/backend-factory';
import type { Observability } from '../port/observability';
import { createClientObservability } from './create-client-observability';

const ObservabilityContext = createContext<Observability | null>(null);

export type ObservabilityProviderProps = {
  readonly children: ReactNode;
  readonly serviceName?: string;
  readonly backendEnv?: string | undefined;
  readonly forceNoop?: boolean;
  readonly collectorUrl?: string;
  readonly observability?: Observability;
  /** Required when the resolved backend is `local-file`. */
  readonly createLocalFile?: ObservabilityBackendFactory;
};

export function ObservabilityProvider({
  children,
  serviceName = 'gamezilla-client',
  backendEnv,
  forceNoop,
  collectorUrl,
  observability: observabilityOverride,
  createLocalFile,
}: ObservabilityProviderProps): ReactNode {
  const clock = useClock();
  const createId = useCreateId();
  const observability = useMemo(() => {
    if (observabilityOverride !== undefined) return observabilityOverride;
    return createClientObservability({
      serviceName,
      now: clock.now,
      createId,
      backendEnv,
      ...(forceNoop !== undefined ? { forceNoop } : {}),
      ...(collectorUrl !== undefined ? { collectorUrl } : {}),
      ...(createLocalFile !== undefined ? { createLocalFile } : {}),
    });
  }, [
    observabilityOverride,
    serviceName,
    backendEnv,
    forceNoop,
    collectorUrl,
    createLocalFile,
    clock,
    createId,
  ]);

  return (
    <ObservabilityContext.Provider value={observability}>
      {children}
    </ObservabilityContext.Provider>
  );
}

export function useObservability(): Observability {
  const obs = useContext(ObservabilityContext);
  if (obs === null) {
    throw new Error('useObservability: ObservabilityProvider missing');
  }
  return obs;
}
