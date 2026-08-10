import type { CreateId } from '@pkgs/uuid';
import { createLocalFileObservability } from '../impl-local-file/impl-local-file';
import { createLoggerObservability } from '../impl-logger/impl-logger';
import { createNoopObservability } from '../impl-noop/impl-noop';
import { createClientSentryObservability } from '../impl-sentry/create-client-sentry-observability';
import type { ObservabilityBackend } from '../shared/backend';
import { DEFAULT_COLLECTOR_URL } from '../shared/backend';
import type { HttpFetchFn } from '../shared/types';
import type { Observability } from './observability';

export type ObservabilityConfig = {
  readonly serviceName: string;
  readonly backend: ObservabilityBackend;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly localFile?: {
    readonly collectorUrl?: string;
  };
  readonly fetchFn?: HttpFetchFn;
};

/** Client-side factory. Server code uses `createServerObservability` instead. */
export function createObservability(
  config: ObservabilityConfig
): Observability {
  if (config.backend === 'local-file') {
    return createLocalFileObservability({
      serviceName: config.serviceName,
      now: config.now,
      createId: config.createId,
      collectorUrl: config.localFile?.collectorUrl ?? DEFAULT_COLLECTOR_URL,
      ...(config.fetchFn !== undefined ? { fetchFn: config.fetchFn } : {}),
    });
  }
  if (config.backend === 'logger') {
    return createLoggerObservability({
      serviceName: config.serviceName,
      now: config.now,
      createId: config.createId,
    });
  }
  if (config.backend === 'sentry') {
    return createClientSentryObservability({
      serviceName: config.serviceName,
      now: config.now,
    });
  }
  return createNoopObservability(config.serviceName);
}

export { isObservabilityActive } from './is-observability-active';
