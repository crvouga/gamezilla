import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import type {
  TelemetryOptions,
  TelemetryRuntime,
} from '@pkgs/observability-runtime-shared-ts/options';
import { createProviderConfig } from '@pkgs/observability-runtime-shared-ts/provider-options';
import { createSignals } from '@pkgs/observability-runtime-shared-ts/signals';

export const CONTEXT_CAPABILITY = 'async-context' as const;

export type NodeTelemetryOptions = TelemetryOptions;

export type NodeTelemetry = TelemetryRuntime & {
  readonly provider: NodeTracerProvider;
};

export function createNodeTelemetry(
  options: NodeTelemetryOptions
): NodeTelemetry {
  const provider = new NodeTracerProvider(
    createProviderConfig(options, 'batch')
  );
  if (options.registerGlobal !== false) {
    provider.register({
      contextManager:
        options.contextManager ??
        new AsyncLocalStorageContextManager().enable(),
    });
  }
  const signals = createSignals(options, false);
  return {
    provider,
    forceFlush: async () => {
      await Promise.all([provider.forceFlush(), signals.forceFlush()]);
    },
    shutdown: async () => {
      await Promise.all([provider.shutdown(), signals.shutdown()]);
    },
  };
}
