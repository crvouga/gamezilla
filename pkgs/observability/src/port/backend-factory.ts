import type { CreateId } from '@pkgs/uuid';
import type { HttpFetchFn } from '../shared/types';
import type { Observability, SpanContextStorage } from './observability';

/**
 * What a backend implementation living outside this package receives from the
 * composition root.
 */
export type ObservabilityBackendOptions = {
  readonly serviceName: string;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly collectorUrl?: string;
  readonly fetchFn?: HttpFetchFn;
  readonly storage?: SpanContextStorage;
};

/**
 * Injected constructor for a backend this package does not own — today only
 * `local-file` (`@pkgs/observability-impl-local-file`). `noop` and `logger`
 * ship in-package and need no injection.
 */
export type ObservabilityBackendFactory = (
  options: ObservabilityBackendOptions
) => Observability;

export function requireBackendFactory(
  factory: ObservabilityBackendFactory | undefined,
  backend: string
): ObservabilityBackendFactory {
  if (factory === undefined) {
    throw new Error(
      `observability: backend "${backend}" needs an injected factory — pass createLocalFile from @pkgs/observability-impl-local-file`
    );
  }
  return factory;
}
