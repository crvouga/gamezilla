// @io-wall-ok — Synthetic Population Worker process metrics exporter composition root.
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  type IMetricReader,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import { otlpAuthorization } from '@pkgs/observability-root-shared-ts/otlp-auth';
import { instrumentRealm, type RealmMeasurements } from './realm-measurements';
import type {
  SyntheticPopulationWorker,
  WorkerPorts,
} from './synthetic-population-worker';

type WorkerMeasurements = {
  worker: ReturnType<SyntheticPopulationWorker['status']>;
  resources: ReturnType<WorkerPorts['resources']>;
};
type MetricsComposition = {
  clock: Clock;
  instanceId: string;
  current: () => WorkerMeasurements;
};

function metricProvider(
  env: Readonly<Record<string, string | undefined>>,
  instanceId: string,
  reader?: IMetricReader
) {
  const url = env['OBSERVABILITY_METRICS_COLLECTOR_URL']?.trim();
  if (env['OBSERVABILITY_ENABLED'] === '0' || (!url && reader === undefined))
    return null;
  const authorization = otlpAuthorization({
    user: env['OBSERVABILITY_COLLECTOR_USER'],
    token: env['OBSERVABILITY_COLLECTOR_TOKEN'],
  });
  return new MeterProvider({
    resource: resourceFromAttributes({
      'service.name': serviceName('synthetic-population-worker'),
      'service.version': env['DEPLOYMENT_VERSION'] ?? 'local',
      'service.instance.id': instanceId,
      'deployment.environment.name': env['DEPLOYMENT_ENVIRONMENT'] ?? 'local',
    }),
    readers: [
      reader ??
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            ...(url === undefined ? {} : { url }),
            timeoutMillis: 5_000,
            headers:
              authorization === undefined
                ? {}
                : { Authorization: authorization },
          }),
          exportIntervalMillis: 30_000,
          exportTimeoutMillis: 5_000,
        }),
    ],
  });
}

function registerWorkerMeasurements(
  provider: MeterProvider,
  current: MetricsComposition['current']
): void {
  const meter = provider.getMeter('synthetic-population');
  const readings = {
    population_desired: () => current().worker.desired,
    population_workers_ready: () => Number(current().worker.ready),
    population_workers_draining: () => Number(current().worker.draining),
    population_capacity: () => current().worker.capacity,
    population_worker_memory_bytes: () => current().resources.memoryBytes,
    population_worker_cpu_milliseconds: () =>
      current().resources.cpuMilliseconds,
  };
  for (const [name, read] of Object.entries(readings)) {
    meter.createObservableGauge(name).addCallback((result) => {
      const value = read();
      if (value !== null) result.observe(value);
    });
  }
  meter
    .createObservableCounter('population_lease_failures_total')
    .addCallback((result) => result.observe(current().worker.leaseFailures));
}

/** One exporter per process; Synthetic User identities never become metric labels. */
export function syntheticPopulationMetrics(
  env: Readonly<Record<string, string | undefined>>,
  composition: MetricsComposition,
  reader?: IMetricReader
) {
  const provider = metricProvider(env, composition.instanceId, reader);
  const realms = new Set<RealmMeasurements>();
  const meter = provider?.getMeter('synthetic-population');
  const counts = {
    population_online: (realm: RealmMeasurements) => realm.online,
    population_active: (realm: RealmMeasurements) =>
      realm.online &&
      ['hosting', 'joining', 'matchmaking', 'playing'].includes(realm.activity),
    population_matchmaking: (realm: RealmMeasurements) =>
      realm.online && realm.activity === 'matchmaking',
    population_playing: (realm: RealmMeasurements) =>
      realm.online && realm.activity === 'playing',
  };
  for (const [name, includes] of Object.entries(counts))
    meter
      ?.createObservableGauge(name)
      .addCallback((result) =>
        result.observe([...realms].filter(includes).length)
      );
  if (provider !== null)
    registerWorkerMeasurements(provider, composition.current);
  const instruments = {
    authenticationFailures: meter?.createCounter(
      'population_auth_failures_total'
    ),
    actionFailures: meter?.createCounter('population_action_failures_total'),
    recoveries: meter?.createCounter('population_recoveries_total'),
    recoveryDuration: meter?.createHistogram(
      'population_recovery_duration_seconds',
      { unit: 's' }
    ),
    authenticationDuration: meter?.createHistogram(
      'population_authentication_duration_seconds',
      { unit: 's' }
    ),
    actionDuration: meter?.createHistogram(
      'population_ui_action_duration_seconds',
      { unit: 's' }
    ),
  };
  return {
    realm: instrumentRealm({ clock: composition.clock, realms, instruments }),
    forceFlush: () =>
      provider?.forceFlush({ timeoutMillis: 5_000 }) ?? Promise.resolve(),
    shutdown: () =>
      provider?.shutdown({ timeoutMillis: 5_000 }) ?? Promise.resolve(),
  };
}
