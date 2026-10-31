import { afterEach, expect, test } from 'bun:test';
import { type Meter, type MeterProvider, metrics } from '@opentelemetry/api';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { installSyncPerformance } from '@pkgs/observability-root-shared-ts/metric-contract';
import { createSyncHttpClient } from '@pkgs/sync-engine-client-ts/sync-http-client';

afterEach(() => metrics.disable());
const mutation = {
  id: 'write',
  name: 'save',
  args: '{}',
  clientId: 'client',
  seq: 1,
  createdAt: '2026-10-30T00:00:00.000Z',
  originTraceparent: null,
};
const applied = { mutationId: 'write', status: 'applied' };
const valid = { ok: true, serverTimeMs: 1, ackSeq: 1, verdicts: [applied] };

for (const [body, outcome] of [
  [null, 'bad'],
  [{}, 'bad'],
  [{ ...valid, verdicts: [] }, 'bad'],
  [{ ...valid, verdicts: [applied, applied] }, 'bad'],
  [{ ...valid, verdicts: [{ mutationId: 'other', status: 'applied' }] }, 'bad'],
  [valid, 'good'],
  [
    {
      ...valid,
      verdicts: [
        {
          mutationId: 'write',
          status: 'rejected',
          code: 'DENIED',
          message: 'Not allowed',
        },
      ],
    },
    'good',
  ],
] as const) {
  test(`HTTP timing classifies ${JSON.stringify(body)} without changing the response`, async () => {
    const outcomes: string[] = [];
    const meter = {
      createCounter: (name: string) => ({
        add: (_: number, attrs: Record<string, string>) => {
          if (name === 'sync.work.target') outcomes.push(attrs['app.outcome']!);
        },
      }),
      createHistogram: () => ({ record: () => {} }),
    } as unknown as Meter;
    metrics.setGlobalMeterProvider({ getMeter: () => meter } as MeterProvider);
    const { clock, timers } = createHarnessClock({ startMs: 0 });
    const stop = installSyncPerformance(clock.now);
    const client = createSyncHttpClient({
      getBaseUrl: () => 'https://sync.test',
      fetchFn: async () => Response.json(body),
      auth: {
        getAccountId: () => null,
        getDeviceId: () => 'client',
        getSessionToken: () => null,
      },
      now: clock.now,
      timers,
    });
    try {
      const received: unknown = await client.postMutations([mutation]);
      expect(received).toEqual(body);
      expect(outcomes).toEqual([outcome, outcome, outcome]);
    } finally {
      stop();
    }
  });
}
