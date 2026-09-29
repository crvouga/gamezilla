// @io-wall-ok — reads the fixture objective file.
/**
 * Strategy § 21: the objective check must detect realistic degradation.
 * The fixture product with seeded faults — slower delivery, an error burst,
 * a broken adapter — must make the comparison the bridge runs report the
 * objective it breaks, and only that one.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkObjectiveSpec } from '@pkgs/openslo/check';
import type { ObjectivesBinding } from '@pkgs/openslo/registry';
import {
  type DeliveryFaults,
  deliveryMeasures,
  NOW_MS,
} from './openslo/delivery-product';

const TEXT = readFileSync(
  join(import.meta.dir, 'fixtures/note-delivery.openslo.yaml'),
  'utf8'
);

const binding = (measure: ObjectivesBinding['measure']): ObjectivesBinding => ({
  spec: 'note-delivery',
  measure,
  nowMs: () => NOW_MS,
});

async function unmet(faults: DeliveryFaults): Promise<readonly string[]> {
  const checked = await checkObjectiveSpec({
    text: TEXT,
    binding: binding(deliveryMeasures(faults)),
  });
  expect(checked.issues).toEqual([]);
  return checked.results.filter((r) => !r.evaluation.met).map((r) => r.id);
}

describe('seeded faults', () => {
  test('the healthy product meets every objective', async () => {
    expect(await unmet({})).toEqual([]);
  });

  test('degraded latency breaks the p95 objective', async () => {
    expect(await unmet({ slowerByMs: 100 })).toEqual([
      'objective:note-delivery-latency:p95 under 200 ms',
    ]);
  });

  test('latency past the p99 bound breaks both latency objectives', async () => {
    expect(await unmet({ slowerByMs: 400 })).toEqual([
      'objective:note-delivery-latency:p95 under 200 ms',
      'objective:note-delivery-latency:p99 under 500 ms',
    ]);
  });

  test('an eight-hour error burst breaks delivery and the hourly objective', async () => {
    const burst = { fromMs: NOW_MS - 8 * 3_600_000, toMs: NOW_MS };
    expect(await unmet({ burst })).toEqual([
      'objective:note-delivery-success:99% of notes delivered',
      'objective:note-delivery-hourly:every hour this week delivers',
    ]);
  });

  test('a one-hour burst spends budget but breaks only the hourly objective', async () => {
    const burst = { fromMs: NOW_MS - 3_600_000, toMs: NOW_MS - 1 };
    expect(await unmet({ burst })).toEqual([
      'objective:note-delivery-hourly:every hour this week delivers',
    ]);
  });
});

describe('broken adapters', () => {
  const healthy = deliveryMeasures();

  test('a measure that returns nothing is no evidence', async () => {
    const checked = await checkObjectiveSpec({
      text: TEXT,
      binding: {
        spec: 'note-delivery',
        measure: {
          ...healthy,
          'note-delivered': async () => ({ kind: 'events', events: [] }),
        },
      },
    });
    const delivery = checked.results.find(
      (r) => r.slo === 'note-delivery-success'
    );
    expect(delivery?.evaluation.met).toBe(false);
    expect(delivery?.evaluation.detail).toContain('no evidence');
  });

  test('a measure that throws fails its objectives with the cause', async () => {
    const checked = await checkObjectiveSpec({
      text: TEXT,
      binding: binding({
        ...healthy,
        'note-delivery-time': async () => {
          throw new Error('telemetry unreachable');
        },
      }),
    });
    const latency = checked.results.filter(
      (r) => r.slo === 'note-delivery-latency'
    );
    expect(latency.map((r) => r.evaluation.detail)).toEqual([
      'the measure for SLI note-delivery-time failed: telemetry unreachable',
      'the measure for SLI note-delivery-time failed: telemetry unreachable',
    ]);
  });

  test('a measure of the wrong kind fails', async () => {
    const checked = await checkObjectiveSpec({
      text: TEXT,
      binding: binding({
        ...healthy,
        'note-delivery-time':
          healthy['note-delivered'] ??
          (async () => ({ kind: 'events', events: [] })),
      }),
    });
    const latency = checked.results.filter(
      (r) => r.slo === 'note-delivery-latency'
    );
    expect(latency.every((r) => !r.evaluation.met)).toBe(true);
  });

  test('a missing measure and an orphan measure are binding issues', async () => {
    const { 'note-delivery-time': _dropped, ...rest } = healthy;
    const checked = await checkObjectiveSpec({
      text: TEXT,
      binding: binding({
        ...rest,
        'note-deleted': async () => ({ kind: 'events', events: [] }),
      }),
    });
    expect(checked.issues).toEqual([
      "SLI note-delivery-time has no measure — add measure['note-delivery-time'] to tests/openslo/note-delivery.binding.ts",
      'tests/openslo/note-delivery.binding.ts measures note-deleted, which names no SLI in the file',
    ]);
    const latency = checked.results.filter(
      (r) => r.slo === 'note-delivery-latency'
    );
    expect(latency.every((r) => !r.evaluation.met)).toBe(true);
  });

  test('without an injected clock, now is the latest measured moment', async () => {
    const checked = await checkObjectiveSpec({
      text: TEXT,
      binding: { spec: 'note-delivery', measure: healthy },
    });
    expect(checked.results.every((r) => r.evaluation.met)).toBe(true);
  });
});
