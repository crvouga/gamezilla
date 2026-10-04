/** Builders for parsed SLIs, SLOs and objectives, for evaluation tests. */

import type {
  Objective,
  Sli,
  Slo,
  TimeWindow,
} from '@pkgs/openslo-shared/model';

const source = { type: 'product', spec: { event: 'note saved' } };

export const RATIO_SLI: Sli = {
  name: 'delivered',
  displayName: null,
  description: null,
  inline: false,
  metric: {
    kind: 'ratio',
    counter: true,
    good: source,
    bad: null,
    total: source,
  },
};

export const THRESHOLD_SLI: Sli = {
  name: 'latency',
  displayName: null,
  description: null,
  inline: false,
  metric: { kind: 'threshold', source },
};

export function objective(overrides: Partial<Objective> = {}): Objective {
  return {
    displayName: 'objective',
    target: 0.9,
    op: null,
    value: null,
    timeSliceTarget: null,
    timeSliceWindow: null,
    ...overrides,
  };
}

export function slo(
  overrides: Partial<Slo> & { readonly window?: TimeWindow } = {}
): Slo {
  const { window, ...rest } = overrides;
  return {
    name: 'delivery',
    displayName: null,
    description: null,
    service: 'sync-engine',
    indicator: 'delivered',
    timeWindow: window ?? { duration: '1h', isRolling: true, calendar: null },
    budgetingMethod: 'Occurrences',
    objectives: [],
    ...rest,
  };
}

export const HOUR = 3_600_000;
export const NOW = Date.UTC(2026, 8, 28, 12);

/** `goods` good then `bads` bad events, one a second ending at `NOW`. */
export function events(goods: number, bads: number) {
  const total = goods + bads;
  return Array.from({ length: total }, (_, i) => ({
    atMs: NOW - (total - 1 - i) * 1000,
    good: i < goods,
  }));
}
