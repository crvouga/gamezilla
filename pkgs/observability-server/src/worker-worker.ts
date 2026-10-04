import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import type { TelemetryOptions, TelemetryRuntime } from '@pkgs/observability-shared/options';
import { createProviderConfig } from '@pkgs/observability-shared/provider-options';

export const CONTEXT_CAPABILITY = 'async-context' as const;

export type ExecutionWaitUntil = (promise: Promise<unknown>) => void;

export type WorkerTelemetry = TelemetryRuntime & {
  readonly provider: NodeTracerProvider;
  readonly flushWith: (waitUntil: ExecutionWaitUntil) => void;
};

export function extractRequestContext(headers: Headers): Context {
  return propagation.extract(ROOT_CONTEXT, headers, {
    keys: (carrier) => [...carrier.keys()],
    get: (carrier, key) => carrier.get(key) ?? undefined,
  });
}

export function injectRequestHeaders(
  headers: Headers,
  source: Context = context.active()
): void {
  propagation.inject(source, headers, {
    set: (carrier, key, value) => carrier.set(key, value),
  });
}

export function createWorkerTelemetry(
  options: TelemetryOptions
): WorkerTelemetry {
  const provider = new NodeTracerProvider(
    createProviderConfig(options, 'simple')
  );
  if (options.registerGlobal !== false) {
    provider.register({
      contextManager:
        options.contextManager ??
        new AsyncLocalStorageContextManager().enable(),
    });
  }
  return {
    provider,
    forceFlush: () => provider.forceFlush(),
    shutdown: () => provider.shutdown(),
    flushWith(waitUntil) {
      waitUntil(provider.forceFlush());
    },
  };
}

import {
  type Context,
  context,
  propagation,
  ROOT_CONTEXT,
} from '@opentelemetry/api';
