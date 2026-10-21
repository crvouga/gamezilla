import { describe, expect, test } from 'bun:test';
import { alertingBinding } from '@libs/observability-shared/slo-alerts';
import {
  metricMeasures,
  metricSettings,
} from '@libs/observability-shared/slo-live';
import { checkObjectiveSpec } from '@pkgs/openslo-shared/check';
import { measureAlerts } from '@pkgs/openslo-shared/check-alerts';
import { parseOpenSlo } from '@pkgs/openslo-shared/parse';
import type { ObjectivesBinding } from '@pkgs/openslo-shared/registry';
import type { Traffic } from './fake-metrics';
import { fakeMetrics, httpSeries, replaySeries } from './fake-metrics';
import { readRepoFile } from './specs';

const NOW = Date.UTC(2026, 9, 15, 12);
const ENV = 'prd';
const PEOPLE = ['sync', 'session', 'room', 'billing', 'app'];

const SUCCESS = readRepoFile('specs/runtime/request-success.openslo.yaml');
const SPEED = readRepoFile('specs/runtime/request-speed.openslo.yaml');

const healthyTraffic: readonly Traffic[] = [
  ...PEOPLE.map((group) => ({
    group,
    statusClass: '2xx',
    perSecond: 1,
    seconds: 0.08,
  })),
  { group: 'media', statusClass: '2xx', perSecond: 0.1, seconds: 4 },
  { group: 'machine', statusClass: '2xx', perSecond: 20, seconds: 0.3 },
  { group: 'telemetry', statusClass: '2xx', perSecond: 5, seconds: 0.05 },
];

function productSeries(
  traffic: readonly Traffic[],
  replays: Readonly<Record<string, number>> = { applied: 2, rejected: 0.2 }
) {
  return [...httpSeries(ENV, traffic), ...replaySeries(ENV, replays)];
}

function binding(
  series: ReturnType<typeof productSeries>,
  slis: readonly string[]
): ObjectivesBinding {
  return {
    spec: 'live',
    nowMs: () => NOW,
    measure: metricMeasures({
      client: fakeMetrics(series),
      environment: ENV,
      slis,
    }),
    alerting: alertingBinding(),
  };
}

async function verdicts(
  text: string,
  series: ReturnType<typeof productSeries>,
  slis: readonly string[]
) {
  const checked = await checkObjectiveSpec({
    text,
    binding: binding(series, slis),
  });
  return Object.fromEntries(checked.results.map((r) => [r.slo, r]));
}

const SUCCESS_SLIS = ['people-requests-served', 'changes-saved-first-time'];
const SPEED_SLIS = [
  'people-requests-answered-within-half-a-second',
  'people-requests-answered-within-two-and-a-half-seconds',
];

describe('a product that behaves', () => {
  test('meets every objective, judged on people alone', async () => {
    const success = await verdicts(
      SUCCESS,
      productSeries(healthyTraffic),
      SUCCESS_SLIS
    );
    const speed = await verdicts(
      SPEED,
      productSeries(healthyTraffic),
      SPEED_SLIS
    );
    for (const result of [...Object.values(success), ...Object.values(speed)]) {
      expect(result.evaluation.met, result.evaluation.detail).toBe(true);
    }
  });
});

// regression: availability-objective-measured-from-ci-history-only
describe('a product that degrades', () => {
  test('failures people meet break availability', async () => {
    const broken = healthyTraffic.map((t) =>
      t.group === 'sync' ? { ...t, statusClass: '5xx' } : t
    );
    const results = await verdicts(
      SUCCESS,
      productSeries(broken),
      SUCCESS_SLIS
    );
    expect(results['the-app-serves-people']?.evaluation.met).toBe(false);
    // People send 5.1 requests a second (media included); 1 of them fails.
    expect(results['the-app-serves-people']?.evaluation.observed).toBeCloseTo(
      4.1 / 5.1,
      6
    );
  });

  test('failures only machines meet do not', async () => {
    const machinesFail = healthyTraffic.map((t) =>
      t.group === 'machine' || t.group === 'telemetry'
        ? { ...t, statusClass: '5xx' }
        : t
    );
    const results = await verdicts(
      SUCCESS,
      productSeries(machinesFail),
      SUCCESS_SLIS
    );
    expect(results['the-app-serves-people']?.evaluation.met).toBe(true);
  });

  test('a client mistake is not a failure of the app', async () => {
    const refused = healthyTraffic.map((t) =>
      t.group === 'sync' ? { ...t, statusClass: '4xx' } : t
    );
    const results = await verdicts(
      SUCCESS,
      productSeries(refused),
      SUCCESS_SLIS
    );
    expect(results['the-app-serves-people']?.evaluation.met).toBe(true);
  });

  test('replays the database failed break saving, but rules turning one down do not', async () => {
    const turnedDown = await verdicts(
      SUCCESS,
      productSeries(healthyTraffic, { applied: 1, rejected: 5 }),
      SUCCESS_SLIS
    );
    expect(turnedDown['changes-are-saved']?.evaluation.met).toBe(true);
    const failing = await verdicts(
      SUCCESS,
      productSeries(healthyTraffic, { applied: 1, failed: 0.01 }),
      SUCCESS_SLIS
    );
    expect(failing['changes-are-saved']?.evaluation.met).toBe(false);
  });

  test('slow answers people wait on break both speed objectives by their own bound', async () => {
    const slowish = healthyTraffic.map((t) =>
      t.group === 'sync' ? { ...t, seconds: 1 } : t
    );
    const results = await verdicts(SPEED, productSeries(slowish), SPEED_SLIS);
    // 1s answers pass the 2.5s bound but miss the 0.5s one; sync is 1 of 5 groups.
    expect(results['the-app-answers-people-quickly']?.evaluation.met).toBe(
      false
    );
    expect(
      results['the-app-answers-people-quickly']?.evaluation.observed
    ).toBeCloseTo(0.8, 6);
    expect(results['the-app-never-leaves-people-waiting']?.evaluation.met).toBe(
      true
    );
    const verySlow = healthyTraffic.map((t) =>
      t.group === 'sync' ? { ...t, seconds: 6 } : t
    );
    const worse = await verdicts(SPEED, productSeries(verySlow), SPEED_SLIS);
    expect(worse['the-app-never-leaves-people-waiting']?.evaluation.met).toBe(
      false
    );
  });

  test('slow generated speech and slow machines do not count against speed', async () => {
    const slowElsewhere = healthyTraffic.map((t) =>
      t.group === 'media' || t.group === 'machine' ? { ...t, seconds: 30 } : t
    );
    const results = await verdicts(
      SPEED,
      productSeries(slowElsewhere),
      SPEED_SLIS
    );
    expect(Object.values(results).every((r) => r.evaluation.met)).toBe(true);
  });

  test("another environment's traffic is not this environment's", async () => {
    const otherEnvironment = httpSeries(
      'dev',
      healthyTraffic.map((t) => ({ ...t, statusClass: '5xx' }))
    );
    const results = await verdicts(
      SUCCESS,
      [...productSeries(healthyTraffic), ...otherEnvironment],
      SUCCESS_SLIS
    );
    expect(results['the-app-serves-people']?.evaluation.met).toBe(true);
  });
});

describe('a product that is silent', () => {
  test('with no series at all is no evidence, never a pass', async () => {
    const results = await verdicts(SUCCESS, [], SUCCESS_SLIS);
    for (const result of Object.values(results)) {
      expect(result.evaluation.met).toBe(false);
      expect(result.evaluation.detail).toContain('no evidence');
    }
  });

  test('a backend that errors fails with the reason', async () => {
    const checked = await checkObjectiveSpec({
      text: SUCCESS,
      binding: {
        spec: 'live',
        nowMs: () => NOW,
        measure: metricMeasures({
          client: {
            instant: async () => {
              throw new Error(
                'Prometheus answered 401 (token lacks metrics:read)'
              );
            },
          },
          environment: ENV,
          slis: SUCCESS_SLIS,
        }),
      },
    });
    expect(checked.results.every((r) => !r.evaluation.met)).toBe(true);
    expect(checked.results[0]?.evaluation.detail).toContain(
      'token lacks metrics:read'
    );
  });
});

describe('asking the backend', () => {
  test('counts a window in whole seconds at the moment it ends', async () => {
    const client = fakeMetrics(productSeries(healthyTraffic));
    const measures = metricMeasures({
      client,
      environment: ENV,
      slis: ['people-requests-served'],
    });
    const measure = measures['people-requests-served'];
    await measure?.({ nowMs: NOW, startMs: NOW - 3_600_000, endMs: NOW });
    expect(client.queries).toHaveLength(2);
    for (const query of client.queries) {
      expect(query.atMs).toBe(NOW);
      expect(query.query).toContain('[3600s]');
    }
  });

  test('asks the same question once for indicators that share it', async () => {
    const client = fakeMetrics(productSeries(healthyTraffic));
    const measures = metricMeasures({
      client,
      environment: ENV,
      slis: SPEED_SLIS,
    });
    const window = { nowMs: NOW, startMs: NOW - 60_000, endMs: NOW };
    await measures[SPEED_SLIS[0] ?? '']?.(window);
    await measures[SPEED_SLIS[1] ?? '']?.(window);
    // Two goods (different bounds) and one shared total.
    expect(client.queries).toHaveLength(3);
  });

  test('refuses an indicator the catalog does not have, and no environment', () => {
    const client = fakeMetrics([]);
    expect(() =>
      metricMeasures({ client, environment: ENV, slis: ['nope'] })
    ).toThrow('no metric indicator named nope');
    expect(() =>
      metricMeasures({ client, environment: ' ', slis: [] })
    ).toThrow('need an environment');
  });

  test('never reads a negative count as a count', async () => {
    const measures = metricMeasures({
      client: { instant: async () => [{ labels: {}, value: -1 }] },
      environment: ENV,
      slis: ['people-requests-served'],
    });
    await expect(
      measures['people-requests-served']?.({
        nowMs: NOW,
        startMs: 0,
        endMs: NOW,
      })
    ).rejects.toThrow('for a count of events');
  });
});

describe('alerts on the same product', () => {
  const parsed = parseOpenSlo(SUCCESS);
  if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
  const serves = parsed.doc.slos.find(
    (slo) => slo.name === 'the-app-serves-people'
  );
  if (serves === undefined) throw new Error('no slo');

  test('stay quiet on a healthy product, with the budget in the message', async () => {
    const results = await measureAlerts({
      doc: parsed.doc,
      slo: serves,
      binding: binding(productSeries(healthyTraffic), SUCCESS_SLIS),
    });
    expect(results.map((r) => r.ok)).toEqual([true, true, true]);
    expect(results[0]?.detail).toContain(
      '100% of the 28d error budget remains'
    );
  });

  test('page with the bun obs command when people meet failures', async () => {
    const broken = healthyTraffic.map((t) =>
      t.group === 'sync' ? { ...t, statusClass: '5xx' } : t
    );
    const results = await measureAlerts({
      doc: parsed.doc,
      slo: serves,
      binding: binding(productSeries(broken), SUCCESS_SLIS),
    });
    expect(results.every((r) => !r.ok)).toBe(true);
    const fast = results.find((r) => r.policy.endsWith('fast-burn'));
    expect(fast?.detail).toContain('PAGE the-app-serves-people');
    expect(fast?.detail).toContain('Owner: runtime');
    expect(fast?.detail).toContain(
      'Investigate with: bun obs errors --since 1h --source prod'
    );
    const ticket = results.find((r) => r.policy.endsWith('budget-drift'));
    expect(ticket?.detail).toContain('bun obs errors --since 3d --source prod');
  });
});

describe('the read credentials', () => {
  const full = {
    OBS_PROMETHEUS_URL: ' https://prom.example/api/prom ',
    OBS_PROMETHEUS_USER: '77',
    OBS_TEMPO_TOKEN: 'glc_x',
  };

  test('come from the secrets the foundation stores', () => {
    expect(metricSettings(full)).toEqual({
      baseUrl: 'https://prom.example/api/prom',
      user: '77',
      token: 'glc_x',
    });
  });

  test.each([
    [
      { ...full, OBS_PROMETHEUS_URL: undefined },
      'OBS_PROMETHEUS_URL is not set',
    ],
    [
      { ...full, OBS_PROMETHEUS_USER: ' ', OBS_TEMPO_TOKEN: '' },
      'OBS_PROMETHEUS_USER, OBS_TEMPO_TOKEN are not set',
    ],
  ])('%p says what is missing', (vars, message) => {
    expect(() => metricSettings(vars)).toThrow(message);
  });
});
