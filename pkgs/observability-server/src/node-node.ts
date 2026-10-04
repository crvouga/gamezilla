import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import type {
  TelemetryOptions,
  TelemetryRuntime,
} from '@pkgs/observability-runtime-shared/options';
import { createProviderConfig } from '@pkgs/observability-runtime-shared/provider-options';

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
  return {
    provider,
    forceFlush: () => provider.forceFlush(),
    shutdown: () => provider.shutdown(),
  };
}
