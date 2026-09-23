import type { CreateId } from '@pkgs/uuid';
import { createLoggerObservability } from '../impl-logger/impl-logger';
import { createNoopObservability } from '../impl-noop/impl-noop';
import {
  type ObservabilityBackendFactory,
  requireBackendFactory,
} from '../port/backend-factory';
import type { Observability } from '../port/observability';
import {
  DEFAULT_COLLECTOR_URL,
  resolveObservabilityBackend,
} from '../shared/backend';
import { createAsyncLocalSpanContextStorage } from './context-storage';

export type CreateServerObservabilityOptions = {
  readonly serviceName: string;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly envBackend?: string | undefined | null;
  readonly collectorUrl?: string;
  /** Required when the resolved backend is `local-file`. */
  readonly createLocalFile?: ObservabilityBackendFactory;
};

export function createServerObservability(
  options: CreateServerObservabilityOptions
): Observability {
  const backend = resolveObservabilityBackend(options.envBackend);
  const storage = createAsyncLocalSpanContextStorage();
  if (backend === 'local-file') {
    return requireBackendFactory(
      options.createLocalFile,
      'local-file'
    )({
      serviceName: options.serviceName,
      now: options.now,
      createId: options.createId,
      collectorUrl: options.collectorUrl ?? DEFAULT_COLLECTOR_URL,
      storage,
    });
  }
  if (backend === 'logger') {
    return createLoggerObservability({
      serviceName: options.serviceName,
      now: options.now,
      createId: options.createId,
      storage,
    });
  }
  return createNoopObservability(options.serviceName);
}
