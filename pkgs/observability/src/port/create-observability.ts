import type { ObservabilityBackend } from '../shared/backend';
import { DEFAULT_COLLECTOR_URL } from '../shared/backend';
import type { HttpFetchFn } from '../shared/types';
import type { Observability } from './observability';
import { createNoopObservability } from '../impl-noop/impl-noop';
import { createLocalFileObservability } from '../impl-local-file/impl-local-file';

export type ObservabilityConfig = {
  readonly serviceName: string;
  readonly backend: ObservabilityBackend;
  readonly localFile?: {
    readonly collectorUrl?: string;
  };
  readonly fetchFn?: HttpFetchFn;
};

export function createObservability(config: ObservabilityConfig): Observability {
  if (config.backend === 'local-file') {
    return createLocalFileObservability({
      serviceName: config.serviceName,
      collectorUrl: config.localFile?.collectorUrl ?? DEFAULT_COLLECTOR_URL,
      ...(config.fetchFn !== undefined ? { fetchFn: config.fetchFn } : {}),
    });
  }
  return createNoopObservability(config.serviceName);
}

export function isObservabilityActive(obs: Observability): boolean {
  return obs.backend !== 'noop';
}
