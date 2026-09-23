import type { CreateId } from '@pkgs/uuid';

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

export type CreateClientObservabilityArgs = {
  readonly serviceName: string;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly backendEnv?: string | undefined;
  readonly collectorUrl?: string;
  /** Required when the resolved backend is `local-file`. */
  readonly createLocalFile?: ObservabilityBackendFactory;
};

/**
 * Framework-free client {@link Observability} factory shared by the UI
 * providers. Resolves the backend from `backendEnv` / build mode.
 */
export function createClientObservability(
  args: CreateClientObservabilityArgs
): Observability {
  const backend = resolveObservabilityBackend(args.backendEnv);
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
