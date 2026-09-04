import { useClock } from '@pkgs/clock';
import { type CreateId, useCreateId } from '@pkgs/uuid';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { createLoggerObservability } from '../impl-logger/impl-logger';
import { createNoopObservability } from '../impl-noop/impl-noop';
import {
  type ObservabilityBackendFactory,
  requireBackendFactory,
} from '../port/backend-factory';
import { InMemorySpanContextStorage } from '../port/in-memory-context-storage';
import type { Observability } from '../port/observability';
import {
  DEFAULT_COLLECTOR_URL,
  resolveObservabilityBackend,
} from '../shared/backend';

declare const __DEV__: boolean | undefined;

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined'
    ? __DEV__
    : process.env['NODE_ENV'] !== 'production';
}

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

function createClientObservability(args: {
  readonly serviceName: string;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly backendEnv?: string | undefined;
  readonly forceNoop?: boolean;
  readonly collectorUrl?: string;
  readonly createLocalFile?: ObservabilityBackendFactory;
}): Observability {
  const backend = resolveObservabilityBackend({
    envBackend: args.backendEnv,
    isProduction: !isDevBuild(),
    ...(args.forceNoop === true ? { forceNoop: true } : {}),
  });
  if (backend === 'local-file') {
    return requireBackendFactory(
      args.createLocalFile,
      'local-file'
    )({
      serviceName: args.serviceName,
      now: args.now,
      createId: args.createId,
      collectorUrl: args.collectorUrl ?? DEFAULT_COLLECTOR_URL,
      storage: new InMemorySpanContextStorage(),
    });
  }
  if (backend === 'logger') {
    return createLoggerObservability({
      serviceName: args.serviceName,
      now: args.now,
      createId: args.createId,
      storage: new InMemorySpanContextStorage(),
    });
  }
  return createNoopObservability(args.serviceName);
}

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
