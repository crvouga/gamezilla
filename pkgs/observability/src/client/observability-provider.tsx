import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  DEFAULT_COLLECTOR_URL,
  resolveObservabilityBackend,
} from '../shared/backend';
import type { Observability } from '../port/observability';
import { InMemorySpanContextStorage } from '../port/in-memory-context-storage';
import { createLocalFileObservability } from '../impl-local-file/impl-local-file';
import { createLoggerObservability } from '../impl-logger/impl-logger';
import { createNoopObservability } from '../impl-noop/impl-noop';
import { createClientSentryObservability } from '../impl-sentry/create-client-sentry-observability';

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
};

function createClientObservability(args: {
  readonly serviceName: string;
  readonly backendEnv?: string | undefined;
  readonly forceNoop?: boolean;
  readonly collectorUrl?: string;
}): Observability {
  const backend = resolveObservabilityBackend({
    envBackend: args.backendEnv,
    isProduction: !isDevBuild(),
    ...(args.forceNoop === true ? { forceNoop: true } : {}),
  });
  if (backend === 'local-file') {
    return createLocalFileObservability({
      serviceName: args.serviceName,
      collectorUrl: args.collectorUrl ?? DEFAULT_COLLECTOR_URL,
      storage: new InMemorySpanContextStorage(),
    });
  }
  if (backend === 'logger') {
    return createLoggerObservability({
      serviceName: args.serviceName,
      storage: new InMemorySpanContextStorage(),
    });
  }
  if (backend === 'sentry') {
    return createClientSentryObservability({
      serviceName: args.serviceName,
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
}: ObservabilityProviderProps): ReactNode {
  const observability = useMemo(() => {
    if (observabilityOverride !== undefined) return observabilityOverride;
    return createClientObservability({
      serviceName,
      backendEnv,
      ...(forceNoop !== undefined ? { forceNoop } : {}),
      ...(collectorUrl !== undefined ? { collectorUrl } : {}),
    });
  }, [observabilityOverride, serviceName, backendEnv, forceNoop, collectorUrl]);

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
