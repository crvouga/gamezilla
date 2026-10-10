import { expect, test } from 'bun:test';
import { syntheticPopulationMetrics } from '@apps/synthetic-population-worker/wall-metrics';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { ControlledRealm, workerFixture } from './worker-fixture';

function metricsFixture() {
  const f = workerFixture();
  const exporter = new InMemoryMetricExporter(
    AggregationTemporality.CUMULATIVE
  );
  const runtime = syntheticPopulationMetrics(
    {},
    {
      clock: f.clock,
      instanceId: 'worker-private-id',
      current: () => ({
        worker: {
          workerId: 'worker-private-id',
          version: 'v2',
          ready: true,
          draining: false,
          active: 2,
          capacity: 2,
          leaseFailures: 3,
          desired: 2,
        },
        resources: { memoryBytes: 100, cpuMilliseconds: 20 },
      }),
    },
    new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 60_000,
    })
  );
  const source = new ControlledRealm();
  const realm = runtime.realm(source);
  realm.subscribe(() => {});
  const event = (
    name: 'RecoveryStarted' | 'SessionRestored' | 'UiDriverAction'
  ) =>
    source.emit({
      type: 'event',
      event: {
        name,
        activity: 'playing',
        action: null,
        context: {
          outcome: 'failed',
          durationMs: 500,
          privateUser: 'private-account-id',
        },
      },
    });
  const readings = () =>
    exporter
      .getMetrics()
      .at(-1)!
      .scopeMetrics.flatMap((scope) => scope.metrics);
  return { f, runtime, realm, source, event, readings };
}

test('metrics aggregate isolated users and report virtual durations without identity labels', async () => {
  const f = metricsFixture();
  try {
    f.realm.post({ type: 'start', assignment: f.f.assignment });
    f.f.clock.advance(2_000);
    f.source.emit({ type: 'authenticated', token: 'private-token' });
    f.realm.post({ type: 'activate' });
    f.source.emit({ type: 'checkpoint', checkpoint: { activity: 'playing' } });
    f.event('RecoveryStarted');
    f.f.clock.advance(3_000);
    f.event('SessionRestored');
    f.event('UiDriverAction');
    await f.runtime.forceFlush();
    const readings = f.readings();
    const point = (name: string) =>
      readings.find((m) => m.descriptor.name === name)!.dataPoints[0]!;
    expect(point('population_online').value).toBe(1);
    expect(point('population_playing').value).toBe(1);
    expect(point('population_lease_failures_total').value).toBe(3);
    expect(point('population_action_failures_total').value).toBe(1);
    expect(point('population_recoveries_total').value).toBe(1);
    expect(point('population_recovery_duration_seconds').value).toMatchObject({
      sum: 3,
      count: 1,
    });
    expect(
      point('population_authentication_duration_seconds').value
    ).toMatchObject({ sum: 2, count: 1 });
    expect(point('population_ui_action_duration_seconds').value).toMatchObject({
      sum: 0.5,
      count: 1,
    });
    expect(
      readings.flatMap((metric) => metric.dataPoints.map((p) => p.attributes))
    ).not.toContainEqual(
      expect.objectContaining({ privateUser: 'private-account-id' })
    );
    f.realm.terminate();
    await f.runtime.forceFlush();
    expect(
      f.readings().find((m) => m.descriptor.name === 'population_online')!
        .dataPoints[0]!.value
    ).toBe(0);
    expect(f.source.terminated).toBe(true);
  } finally {
    await f.runtime.shutdown();
  }
});
