import {
  DEFAULT_COLLECTOR_URL,
  resolveObservabilityBackend,
} from '../shared/backend';
import type { Observability } from '../port/observability';
import { createAsyncLocalSpanContextStorage } from './context-storage';
import { createLocalFileObservability } from '../impl-local-file/impl-local-file';
import { createNoopObservability } from '../impl-noop/impl-noop';

export type CreateServerObservabilityOptions = {
  readonly serviceName: string;
  readonly envBackend?: string | undefined | null;
  readonly forceNoop?: boolean;
  readonly collectorUrl?: string;
};

export function createServerObservability(
  options: CreateServerObservabilityOptions
): Observability {
  const backend = resolveObservabilityBackend({
    envBackend: options.envBackend,
    ...(options.forceNoop === true ? { forceNoop: true } : {}),
  });
  if (backend === 'local-file') {
    return createLocalFileObservability({
      serviceName: options.serviceName,
      collectorUrl: options.collectorUrl ?? DEFAULT_COLLECTOR_URL,
      storage: createAsyncLocalSpanContextStorage(),
    });
  }
  return createNoopObservability(options.serviceName);
}
