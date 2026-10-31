import {
  APP_VERSION,
  getCommitHash,
  hasCommitProvenance,
} from '@libs/app-root-shared-ts/app-metadata';
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import { createBrowserTelemetry } from '@pkgs/observability-root-client-ts/browser';
import { createHttpSpanExporter } from '@pkgs/observability-root-client-ts/http-span-exporter';
import { installMainThreadStallWatch } from '@pkgs/observability-root-client-ts/main-thread-stall';
import { UNSTATED_ENVIRONMENT } from '@pkgs/observability-root-shared-ts/deployment-environment';
import { AcknowledgedLogExporter } from '@pkgs/observability-runtime-shared-ts/acknowledged-log-exporter';
import { acknowledgedMetricExporter } from '@pkgs/observability-runtime-shared-ts/acknowledged-metric-exporter';
import { TelemetryOutbox } from '@pkgs/observability-runtime-shared-ts/telemetry-outbox';
import { setMutationCorrelationIdentity } from '@pkgs/sync-engine-shared-ts/interaction-correlation';
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
  readonly timeOriginMs: number;
  readonly monotonicNow: () => number;
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
  const outbox = new TelemetryOutbox({
    store: args.env.objectStore.withPrefix('observability/outbox/'),
    http: { fetch: createOfflineHttp(args.offline, args.env.server) },
    clock: args.env.clock,
    timers: args.env.timers,
    createId: args.env.createId,
    endpoints: {
      traces: signalUrl(args.env.serverUrl, 'traces'),
      logs: signalUrl(args.env.serverUrl, 'logs'),
    },
  });
  const runtime = openTelemetry(args, buildSha, outbox);
  outbox.start();
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
    void runtime.forceFlush().catch(() => undefined);
  });
  started = {
    flush: () => runtime.forceFlush(),
  };
  return started;
}

function openTelemetry(
  args: BrowserObservabilityArgs,
  buildSha: string,
  outbox: TelemetryOutbox
) {
  const http = outbox.http;
  const tracesUrl = signalUrl(args.env.serverUrl, 'traces');
  return createBrowserTelemetry({
    instanceId: args.env.createId(),
    monotonicNow: args.monotonicNow,
    performanceTimers: args.env.timers,
    syncCohort: () =>
      document.visibilityState === 'visible' ? 'foreground' : 'background',
    metricExporter: acknowledgedMetricExporter(
      signalUrl(args.env.serverUrl, 'metrics'),
      { fetch: createOfflineHttp(args.offline, args.env.server) },
      args.env.timers
    ),
    serviceName: serviceName('client'),
    serviceVersion: APP_VERSION,
    // The server's ingress states the deployment; the page cannot know it.
    environment: UNSTATED_ENVIRONMENT,
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

function signalUrl(
  serverUrl: string,
  signal: 'traces' | 'logs' | 'metrics'
): string {
  return new URL(`/api/observability/v1/${signal}`, serverUrl).toString();
}
