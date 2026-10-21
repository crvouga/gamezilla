/**
 * A deterministic stand-in for a request counter: ten requests a second up to
 * {@link REQUESTS_NOW_MS}, failing 1 in 5 000 at baseline, with an optional
 * outage in which every request fails. Counted per window, as a metrics
 * backend counts, never one request at a time.
 */

import type { AlertingBinding, Measure } from '@pkgs/openslo-shared/registry';

export const REQUESTS_NOW_MS = Date.UTC(2026, 8, 28, 12);
const PER_SECOND = 10;
const BASELINE = 1 / 5000;

export type RequestFaults = {
  /** Every request in `[fromMs, toMs]` fails. */
  readonly outage?: { readonly fromMs: number; readonly toMs: number };
};

export function requestMeasures(
  faults: RequestFaults = {}
): Readonly<Record<string, Measure>> {
  return {
    'requests-answered': async ({ startMs, endMs }) => {
      const seconds = (endMs - startMs) / 1000;
      const total = Math.round(seconds * PER_SECOND);
      let bad = total * BASELINE;
      const { outage } = faults;
      if (outage !== undefined) {
        const overlap =
          Math.min(endMs, outage.toMs) - Math.max(startMs, outage.fromMs);
        if (overlap > 0) bad += (overlap / 1000) * PER_SECOND * (1 - BASELINE);
      }
      return { kind: 'totals', good: total - Math.round(bad), total };
    },
  };
}

export const REQUEST_ALERTING: AlertingBinding = {
  minimumEventsPerHour: () => 100,
  respond: ({ policy }) => ({
    owner: 'runtime',
    runbook: 'https://example.test/runbook',
    command: `bun obs errors --since 1h # ${policy.name}`,
  }),
};
