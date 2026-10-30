import { afterEach, expect, test } from 'bun:test';
import { type Meter, type MeterProvider, metrics } from '@opentelemetry/api';
import { installSyncPerformance } from '@pkgs/observability-root-shared-ts/metric-contract';
import {
  observeSync,
  observeSyncNow,
} from '@pkgs/observability-root-shared-ts/span';

afterEach(() => metrics.disable());
function measurements() {
  const points: {
    name: string;
    value: number;
    attributes: Record<string, string>;
  }[] = [];
  const instrument = (name: string) => ({
    add: (value: number, attributes: Record<string, string>) =>
      points.push({ name, value, attributes }),
    record: (value: number, attributes: Record<string, string>) =>
      points.push({ name, value, attributes }),
  });
  const meter = {
    createCounter: instrument,
    createHistogram: instrument,
  } as unknown as Meter;
  metrics.setGlobalMeterProvider({ getMeter: () => meter } as MeterProvider);
  return points;
}

test('unsampled work counts exact threshold boundaries and failures separately', async () => {
  const points = measurements();
  let now = 0;
  const uninstall = installSyncPerformance(() => now);
  try {
    expect(
      observeSyncNow('database', () => {
        now += 25;
        return 'connected';
      })
    ).toBe('connected');
    await expect(
      observeSync('database', () => {
        now += 1;
        throw new Error('unavailable');
      })
    ).rejects.toThrow('unavailable');
    expect(
      points.filter((p) => p.name === 'sync.work.duration').map((p) => p.value)
    ).toEqual([0.025, 0.001]);
    expect(
      points
        .filter((p) => p.name === 'sync.work.target')
        .map((p) => p.attributes['app.outcome'])
    ).toEqual(['good', 'good', 'bad', 'bad']);
    expect(points.filter((p) => p.name === 'sync.work.started')).toHaveLength(
      2
    );
  } finally {
    uninstall();
  }
});

test('missing and reversed clocks cannot report successful latency', () => {
  const points = measurements();
  observeSyncNow('hash', () => 'hash');
  expect(points).toHaveLength(0);
  let now = 10;
  const uninstall = installSyncPerformance(() => now);
  try {
    observeSyncNow('database', () => {
      now = 0;
    });
    expect(points.filter((p) => p.name === 'sync.work.duration')).toHaveLength(
      0
    );
  } finally {
    uninstall();
  }
});

test('an operation that never finishes consumes its budget once at the deadline', async () => {
  const points = measurements();
  let timeout: (() => void) | undefined;
  let now = 0;
  let finish: () => void = () => {};
  const blocked = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const uninstall = installSyncPerformance(() => now, {
    cohort: () => 'foreground',
    timers: {
      setTimeout: (run) => {
        timeout = run;
        return 1;
      },
      clearTimeout: () => {},
    },
  });
  try {
    const operation = observeSync('read', () => blocked);
    now = 2000;
    timeout?.();
    expect(
      points
        .filter((p) => p.name === 'sync.work.target')
        .map((p) => p.attributes['app.outcome'])
    ).toEqual(['bad', 'bad', 'bad']);
    finish();
    await operation;
    expect(points.filter((p) => p.name === 'sync.work.target')).toHaveLength(3);
  } finally {
    uninstall();
  }
});

test('fulfilled operational failures consume the target budget without changing their result', async () => {
  const points = measurements();
  const uninstall = installSyncPerformance(() => 1);
  const failure = { ok: false, code: 'STORAGE_FULL' };
  try {
    expect(
      await observeSync(
        'local-write',
        () => failure,
        undefined,
        (result) => result.ok
      )
    ).toBe(failure);
    expect(
      points
        .filter((point) => point.name === 'sync.work.target')
        .map((point) => point.attributes['app.outcome'])
    ).toEqual(['bad', 'bad']);
  } finally {
    uninstall();
  }
});

test('shutdown releases pending deadline timers and cannot later count success', async () => {
  const points = measurements();
  let cleared = 0;
  let resolve: () => void = () => {};
  const blocked = new Promise<void>((done) => {
    resolve = done;
  });
  const uninstall = installSyncPerformance(() => 0, {
    timers: {
      setTimeout: () => 1,
      clearTimeout: () => {
        cleared += 1;
      },
    },
  });
  const operation = observeSync('read', () => blocked);
  uninstall();
  expect(cleared).toBe(1);
  resolve();
  await operation;
  expect(
    points
      .filter((point) => point.name === 'sync.work.target')
      .map((point) => point.attributes['app.outcome'])
  ).toEqual(['bad', 'bad', 'bad']);
});

test('persisted queue age consumes the deadline budget and invalid clock evidence stays unknown', async () => {
  const { beginSyncMeasurement } = await import(
    '@pkgs/observability-root-shared-ts/metric-contract'
  );
  const points = measurements();
  let now = 0;
  const stop = installSyncPerformance(() => now);
  try {
    const finish = beginSyncMeasurement('delivery', 300);
    now = 10;
    finish(true);
    beginSyncMeasurement('delivery', -1)(true);
    expect(
      points
        .filter((p) => p.name === 'sync.work.target')
        .map((p) => p.attributes['app.outcome'])
    ).toEqual(['bad', 'good', 'unknown', 'unknown']);
    expect(points.find((p) => p.name === 'sync.work.duration')?.value).toBe(
      0.31
    );
  } finally {
    stop();
  }
});

test('a captured measurement cannot revive a shut down telemetry root', async () => {
  const { captureSyncMeasurement } = await import(
    '@pkgs/observability-root-shared-ts/metric-contract'
  );
  const points = measurements();
  const stop = installSyncPerformance(() => 0);
  const captured = captureSyncMeasurement();
  stop();
  captured('reconnect')(true);
  expect(points).toHaveLength(0);
});
