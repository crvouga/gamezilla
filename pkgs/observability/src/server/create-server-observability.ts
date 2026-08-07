import { createLocalFileObservability } from '../impl-local-file/impl-local-file';
import { createLoggerObservability } from '../impl-logger/impl-logger';
import { createNoopObservability } from '../impl-noop/impl-noop';
import { createServerSentryObservability } from '../impl-sentry/create-server-sentry-observability';
import type { Observability } from '../port/observability';
import {
  DEFAULT_COLLECTOR_URL,
  resolveObservabilityBackend,
} from '../shared/backend';
import { createAsyncLocalSpanContextStorage } from './context-storage';

export type CreateServerObservabilityOptions = {
  readonly serviceName: string;
  readonly envBackend?: string | undefined | null;
  readonly forceNoop?: boolean;
  readonly collectorUrl?: string;
  readonly isProduction?: boolean;
};

export function createServerObservability(
  options: CreateServerObservabilityOptions
): Observability {
  const backend = resolveObservabilityBackend({
    envBackend: options.envBackend,
    isProduction: options.isProduction === true,
    ...(options.forceNoop === true ? { forceNoop: true } : {}),
  });
  const storage = createAsyncLocalSpanContextStorage();
  if (backend === 'local-file') {
    return createLocalFileObservability({
      serviceName: options.serviceName,
      collectorUrl: options.collectorUrl ?? DEFAULT_COLLECTOR_URL,
      storage,
    });
  }
  if (backend === 'logger') {
    return createLoggerObservability({
      serviceName: options.serviceName,
      storage,
    });
  }
  if (backend === 'sentry') {
    return createServerSentryObservability({
      serviceName: options.serviceName,
      storage,
    });
  }
  return createNoopObservability(options.serviceName);
}
