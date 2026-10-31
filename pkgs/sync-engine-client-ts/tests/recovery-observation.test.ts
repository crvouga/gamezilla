import { afterEach, expect, test } from 'bun:test';
import { type Meter, type MeterProvider, metrics } from '@opentelemetry/api';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { installSyncPerformance } from '@pkgs/observability-root-shared-ts/metric-contract';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { createRecoveryObservation } from '@pkgs/sync-engine-client-ts/recovery-observation';

afterEach(() => metrics.disable());
function recording() {
  const targets: string[] = [];
  const meter = {
    createCounter: (name: string) => ({
      add: (_: number, attrs: Record<string, string>) => {
        if (name === 'sync.work.target') targets.push(attrs['app.outcome']!);
      },
    }),
    createHistogram: () => ({ record: () => {} }),
  } as unknown as Meter;
  metrics.setGlobalMeterProvider({ getMeter: () => meter } as MeterProvider);
  return targets;
}

function deferredBacklog(uploadsLocally = true) {
  const { clock, timers } = createHarnessClock();
  let queries = 0;
  let resolve: (rows: { id: string; bytes: number }[]) => void = () => {};
  const pending = new Promise<{ id: string; bytes: number }[]>((done) => {
    resolve = done;
  });
  const db = {
    query: () => {
      queries++;
      return pending;
    },
  } as unknown as SqlClient;
  return {
    observation: createRecoveryObservation(db, () => 'client', {
      timers,
      uploadsLocally,
    }),
    clock,
    queries: () => queries,
    resolve,
  };
}

async function flush() {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

test('recovery waits for fresh scopes and durable verdicts, including acknowledgements racing qualification', async () => {
  const targets = recording();
  let now = 0;
  const stop = installSyncPerformance(() => now);
  const { observation, resolve } = deferredBacklog();
  try {
    observation.start(['scope']);
    observation.scopeSettled('scope'); // A pre-reconnect sweep cannot settle recovery.
    observation.acknowledged(['already-acked']);
    now = 1000;
    resolve([
      { id: 'already-acked', bytes: 100 },
      { id: 'pending', bytes: 100 },
    ]);
    await flush();
    expect(targets).toEqual([]);
    observation.scopesStarted(['scope']);
    observation.scopeSettled('scope');
    expect(targets).toEqual([]);
    now = 2500;
    observation.acknowledged(['pending']);
    expect(targets).toEqual(['bad', 'good']); // Includes the qualification wait.
    observation.acknowledged(['pending']);
    expect(targets).toHaveLength(2);
  } finally {
    observation.cancel();
    stop();
  }
});

for (const rows of [
  Array.from({ length: 101 }, (_, i) => ({ id: String(i), bytes: 1 })),
  [{ id: 'large', bytes: 1024 * 1024 + 1 }],
  [{ id: 'unknown', bytes: Number.NaN }],
]) {
  test('unqualified recovery work cannot satisfy the reference workload target', async () => {
    const targets = recording();
    const stop = installSyncPerformance(() => 0);
    const { observation, resolve } = deferredBacklog();
    try {
      observation.start([]);
      resolve(rows);
      await flush();
      expect(targets).toEqual(['unknown', 'unknown']);
    } finally {
      observation.cancel();
      stop();
    }
  });
}

test('cancelled recovery and obsolete qualification cannot later report success', async () => {
  const targets = recording();
  const stop = installSyncPerformance(() => 0);
  const { observation, resolve } = deferredBacklog();
  try {
    observation.start(['scope']);
    resolve([]);
    await flush();
    observation.cancel();
    observation.scopesStarted(['scope']);
    observation.scopeSettled('scope');
    expect(targets).toEqual(['bad', 'bad']);
  } finally {
    stop();
  }
});

test('acknowledgements missing from the qualification snapshot leave the original workload unknown', async () => {
  const targets = recording();
  const stop = installSyncPerformance(() => 0);
  const { observation, resolve } = deferredBacklog();
  try {
    observation.start([]);
    observation.acknowledged(['removed-before-snapshot']);
    resolve([]);
    await flush();
    expect(targets).toEqual(['unknown', 'unknown']);
  } finally {
    observation.cancel();
    stop();
  }
});

test('qualification bounds acknowledgement memory and cancellation remains visible', async () => {
  const targets = recording();
  const stop = installSyncPerformance(() => 0);
  const { observation, resolve } = deferredBacklog();
  try {
    observation.start([]);
    observation.acknowledged(Array.from({ length: 101 }, (_, i) => String(i)));
    expect(targets).toEqual(['unknown', 'unknown']);
    resolve([]);
    await flush();
    expect(targets).toHaveLength(2);
  } finally {
    observation.cancel();
    stop();
  }
});

test('a rejected original write waits for the repairing snapshot before recovery completes', async () => {
  const targets = recording();
  const stop = installSyncPerformance(() => 0);
  const { observation, resolve } = deferredBacklog();
  try {
    observation.start(['scope']);
    resolve([{ id: 'rejected', bytes: 100 }]);
    await flush();
    observation.scopesStarted(['scope']);
    observation.scopeSettled('scope');
    observation.acknowledged(['rejected'], true);
    observation.scopeSettled('scope');
    expect(targets).toEqual([]);
    observation.scopesStarted(['scope']);
    observation.scopeSettled('scope');
    expect(targets).toEqual(['good', 'good']);
  } finally {
    observation.cancel();
    stop();
  }
});

test('disabled performance telemetry adds no backlog query', () => {
  // regression: disabled-sync-observer-queries-backlog
  let queries = 0;
  const db = {
    query: async () => {
      queries++;
      return [];
    },
  } as unknown as SqlClient;
  const observation = createRecoveryObservation(db, () => 'client', {
    timers: createHarnessClock().timers,
    uploadsLocally: true,
  });
  observation.start(['scope']);
  observation.cancel();
  expect(queries).toBe(0);
});

// regression: follower-recovery-reports-false-failure
test('a follower without local upload acknowledgements reports unknown recovery', async () => {
  const targets = recording();
  const stop = installSyncPerformance(() => 0);
  const { observation, resolve, clock, queries } = deferredBacklog(false);
  try {
    observation.start(['scope']);
    resolve([{ id: 'uploaded-by-leader', bytes: 100 }]);
    await flush();
    observation.scopesStarted(['scope']);
    observation.scopeSettled('scope');
    clock.advance(10_000);
    observation.cancel();
    expect(targets).toEqual(['unknown', 'unknown']);
    expect(queries()).toBe(0);
    expect(clock.pendingOneShotCount()).toBe(0);
  } finally {
    observation.cancel();
    stop();
  }
});

// regression: stalled-recovery-qualification-is-invisible
test('stalled qualification becomes unknown and late completion cannot report success', async () => {
  const targets = recording();
  const stop = installSyncPerformance(() => 0);
  const { observation, resolve, clock } = deferredBacklog();
  try {
    observation.start([]);
    clock.advance(5000);
    expect(targets).toEqual(['unknown', 'unknown']);
    resolve([]);
    await flush();
    observation.cancel();
    clock.advance(5000);
    expect(targets).toEqual(['unknown', 'unknown']);
    expect(clock.pendingOneShotCount()).toBe(0);
  } finally {
    observation.cancel();
    stop();
  }
});
