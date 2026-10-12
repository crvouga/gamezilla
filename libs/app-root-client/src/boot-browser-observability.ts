import {
  APP_VERSION,
  getCommitHash,
  hasCommitProvenance,
} from '@libs/app-root-shared/app-metadata';
import { createBrowserTelemetry } from '@pkgs/observability-root-client/browser';
import { createHttpSpanExporter } from '@pkgs/observability-root-client/http-span-exporter';
import { installMainThreadStallWatch } from '@pkgs/observability-root-client/main-thread-stall';
import { AcknowledgedLogExporter } from '@pkgs/observability-runtime-shared/acknowledged-log-exporter';
import { setMutationCorrelationIdentity } from '@pkgs/sync-engine-shared/interaction-correlation';
import {
  installBrowserObservabilityBoundaries,
  setBrowserTraceFlush,
} from './browser-boundaries';
import {
  browserObservabilityIdentity,
  installBrowserObsHelper,
  setBrowserSessionId,
} from './browser-identity';
import type { ClientEnv } from './client-env';
import type { OfflineNetworkController } from './offline-network-controller';
import { createOfflineHttp } from './offline-network-http';
import { installBrowserPerformanceTelemetry } from './wall';

export type BrowserObservabilityBoot = {
  flush(): Promise<void>;
};

export type BrowserObservabilityArgs = {
  readonly env: ClientEnv;
  readonly offline: OfflineNetworkController;
  readonly dev: boolean;
  readonly timeOriginMs: number;
};

let started: BrowserObservabilityBoot | undefined;

/** One browser OpenTelemetry pipeline for every web composition root. */
export function bootBrowserObservability(
  args: BrowserObservabilityArgs
): BrowserObservabilityBoot {
  if (started !== undefined) return started;
  const buildSha = hasCommitProvenance() ? getCommitHash() : 'development';
  const sessionId = args.env.createId();
  setBrowserSessionId(sessionId);
  setMutationCorrelationIdentity(sessionId, buildSha);
  installBrowserObsHelper();
  const runtime = openTelemetry(args, buildSha);
  const removePerformance = installBrowserPerformanceTelemetry(
    args.env.clock.now
  );
  setBrowserTraceFlush(() => runtime.forceFlush());
  const removeBoundaries = installBrowserObservabilityBoundaries({
    timeOriginMs: args.timeOriginMs,
  });
  const removeStallWatch = installMainThreadStallWatch({
    now: args.env.clock.now,
    timers: args.env.timers,
    document,
  });
  window.addEventListener('pagehide', () => {
    removePerformance();
    removeBoundaries();
    removeStallWatch();
    void runtime.forceFlush();
  });
  started = {
    flush: () => runtime.forceFlush(),
  };
  return started;
}

function openTelemetry(args: BrowserObservabilityArgs, buildSha: string) {
  const http = { fetch: createOfflineHttp(args.offline, args.env.server) };
  const tracesUrl = signalUrl(args.env.serverUrl, 'traces');
  return createBrowserTelemetry({
    serviceName: 'gamezilla-client',
    serviceVersion: APP_VERSION,
    environment: args.dev ? 'local' : 'prod',
    buildSha,
    identity: browserObservabilityIdentity,
    document,
    exporter: createHttpSpanExporter({ url: tracesUrl, http }),
    otlpUrl: tracesUrl,
    logExporter: new AcknowledgedLogExporter(
      signalUrl(args.env.serverUrl, 'logs'),
      {},
      http,
      args.env.timers
    ),
  });
}

function signalUrl(serverUrl: string, signal: 'traces' | 'logs'): string {
  return new URL(`/api/observability/v1/${signal}`, serverUrl).toString();
}
