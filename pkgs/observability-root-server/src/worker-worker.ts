import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import type {
  TelemetryOptions,
  TelemetryRuntime,
} from '@pkgs/observability-runtime-shared/options';
import { createProviderConfig } from '@pkgs/observability-runtime-shared/provider-options';
import { createSignals } from '@pkgs/observability-runtime-shared/signals';

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
  const signals = createSignals(options, true);
  return {
    provider,
    forceFlush: async () => {
      await Promise.all([provider.forceFlush(), signals.forceFlush()]);
    },
    shutdown: async () => {
      await Promise.all([provider.shutdown(), signals.shutdown()]);
    },
    flushWith(waitUntil) {
      waitUntil(
        Promise.allSettled([provider.forceFlush(), signals.forceFlush()])
      );
    },
  };
}

import {
  type Context,
  context,
  propagation,
  ROOT_CONTEXT,
} from '@opentelemetry/api';
