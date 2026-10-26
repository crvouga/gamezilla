import { describe, expect, test } from 'bun:test';
import { measureAlerts } from '@pkgs/openslo-shared-ts/check-alerts';
import type { Measurement } from '@pkgs/openslo-shared-ts/evaluate';
import type { OpenSloDoc, Slo } from '@pkgs/openslo-shared-ts/model';
import { parseOpenSlo } from '@pkgs/openslo-shared-ts/parse';
import type { ObjectivesBinding } from '@pkgs/openslo-shared-ts/registry';

const FILE = `
apiVersion: openslo/v1
kind: SLI
metadata:
  name: requests-served
spec:
  ratioMetric:
    counter: true
    good:
      metricSource: { type: product, spec: { measures: requests answered } }
    total:
      metricSource: { type: product, spec: { measures: requests asked } }
---
apiVersion: openslo/v1
kind: SLO
metadata:
  name: requests-are-served
spec:
  service: runtime
  indicatorRef: requests-served
  timeWindow:
    - duration: 28d
      isRolling: true
  budgetingMethod: Occurrences
  objectives:
    - displayName: nearly every request is served
      target: 0.999
`;

const NOW = Date.UTC(2026, 9, 1, 12);
const MINUTE = 60_000;
const PER_SECOND = 10;

const parsed = parseOpenSlo(FILE);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const doc: OpenSloDoc = parsed.doc;
const [first] = doc.slos;
if (first === undefined) throw new Error('no slo');
const slo: Slo = first;

/** Constant traffic, failing at `rate` during each `[fromMin, toMin]` before now. */
type Failure = {
  readonly agoFrom: number;
  readonly agoTo: number;
  readonly rate: number;
};

function totalsOver(
  window: { startMs: number; endMs: number },
  failures: readonly Failure[],
  baseline: number
): Measurement {
  const seconds = (window.endMs - window.startMs) / 1000;
  const total = Math.round(seconds * PER_SECOND);
  let bad = total * baseline;
  for (const f of failures) {
    const from = Math.max(window.startMs, NOW - f.agoFrom * MINUTE);
    const to = Math.min(window.endMs, NOW - f.agoTo * MINUTE);
    if (to > from)
      bad += ((to - from) / 1000) * PER_SECOND * (f.rate - baseline);
  }
  return { kind: 'totals', good: total - Math.round(bad), total };
}

function bindingFor(
  failures: readonly Failure[],
  baseline = 0.0005
): ObjectivesBinding {
  return {
    spec: 'requests',
    nowMs: () => NOW,
    measure: {
      'requests-served': async ({ startMs, endMs }) =>
        totalsOver({ startMs, endMs }, failures, baseline),
    },
    alerting: {
      minimumEventsPerHour: () => 100,
      respond: ({ policy, lookbackWindow }) => ({
        owner: 'runtime',
        runbook: 'https://example.test/runbook',
        command: `bun obs errors --since ${lookbackWindow} # ${policy.name}`,
      }),
    },
  };
}

async function verdicts(failures: readonly Failure[], baseline?: number) {
  const results = await measureAlerts({
    doc,
    slo,
    binding: bindingFor(failures, baseline),
  });
  return Object.fromEntries(
    results.map((r) => [r.policy.replace('requests-are-served-', ''), r])
  );
}

describe('alerts on a product that behaves', () => {
  test('none fire while failures stay inside the budget', async () => {
    const results = await verdicts([]);
    expect(Object.values(results).every((r) => r.ok)).toBe(true);
    expect(results['fast-burn']?.detail).toContain('not firing');
    expect(results['fast-burn']?.detail).toContain(
      '50% of the 28d error budget remains'
    );
  });
});

describe('alerts on a product that degrades', () => {
  test('a ten minute outage now pages fast and slow and files a ticket', async () => {
    const results = await verdicts([{ agoFrom: 10, agoTo: 0, rate: 1 }]);
    expect(results['fast-burn']?.ok).toBe(false);
    expect(results['slow-burn']?.ok).toBe(false);
    expect(results['budget-drift']?.ok).toBe(false);
  });

  test('says what to do: severity, burn, budget, owner, runbook and the command', async () => {
    const results = await verdicts([{ agoFrom: 10, agoTo: 0, rate: 1 }]);
    const detail = results['fast-burn']?.detail ?? '';
    expect(detail).toContain(
      'PAGE requests-are-served (requests-are-served-fast-burn) is firing'
    );
    expect(detail).toContain('over 1h (limit 14.4x');
    expect(detail).toContain('of the 28d error budget remains');
    expect(detail).toContain('Owner: runtime');
    expect(detail).toContain('Runbook: https://example.test/runbook');
    expect(detail).toContain(
      'Investigate with: bun obs errors --since 1h # requests-are-served-fast-burn'
    );
  });

  test('an outage that ended twenty minutes ago has stopped the fast page but not the slow one', async () => {
    const results = await verdicts([{ agoFrom: 30, agoTo: 20, rate: 1 }]);
    expect(results['fast-burn']?.ok).toBe(true);
    expect(results['slow-burn']?.ok).toBe(false);
  });

  test('a steady 2 percent of failures burns the budget twenty times too fast', async () => {
    const results = await verdicts([], 0.02);
    expect(Object.values(results).every((r) => !r.ok)).toBe(true);
    expect(results['fast-burn']?.detail).toContain('20x over 1h');
  });
});

describe('alerts that cannot be judged', () => {
  test('an unreachable backend fails every policy with its reason', async () => {
    const results = await measureAlerts({
      doc,
      slo,
      binding: {
        ...bindingFor([]),
        measure: {
          'requests-served': async () => {
            throw new Error('Prometheus answered 401');
          },
        },
      },
    });
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results[0]?.detail).toContain(
      'the measure for SLI requests-served failed: Prometheus answered 401'
    );
  });

  test('no events at all is no evidence, never a pass', async () => {
    const results = await measureAlerts({
      doc,
      slo,
      binding: {
        ...bindingFor([]),
        measure: {
          'requests-served': async () => ({
            kind: 'totals',
            good: 0,
            total: 0,
          }),
        },
      },
    });
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results[0]?.detail).toContain('no evidence');
  });

  test('a quiet hour inside a window with events is quiet, not missing evidence', async () => {
    const DAY = 86_400_000;
    const results = await measureAlerts({
      doc,
      slo,
      binding: {
        ...bindingFor([]),
        // Events two days ago, none since: the objective's window has them,
        // the policies' shorter windows do not.
        measure: {
          'requests-served': async ({ endMs, startMs }) =>
            endMs - startMs > DAY
              ? { kind: 'totals', good: 99, total: 100 }
              : { kind: 'totals', good: 0, total: 0 },
        },
      },
    });
    const short = results.filter((r) => !r.policy.endsWith('budget-drift'));
    expect(short.length).toBeGreaterThan(0);
    for (const result of short) {
      expect(result.ok).toBe(true);
      expect(result.detail).toContain('too quiet to judge');
    }
  });

  test('too little traffic stays quiet and says so', async () => {
    const results = await measureAlerts({
      doc,
      slo,
      binding: {
        ...bindingFor([]),
        measure: {
          'requests-served': async ({ startMs, endMs }) => ({
            kind: 'totals',
            good: 0,
            total: Math.round((endMs - startMs) / 3_600_000),
          }),
        },
      },
    });
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results[0]?.detail).toContain('too little traffic');
  });

  test('a binding without a clock cannot say which windows to count', async () => {
    const { nowMs: _unused, ...withoutClock } = bindingFor([]);
    const results = await measureAlerts({ doc, slo, binding: withoutClock });
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(results[0]?.detail).toContain('nowMs');
  });

  test('a file without alerting binds no alerts', async () => {
    const { alerting: _off, ...withoutAlerting } = bindingFor([]);
    expect(await measureAlerts({ doc, slo, binding: withoutAlerting })).toEqual(
      []
    );
  });
});
