import { expect, test } from 'bun:test';
import { syncPerformanceAlerts } from '@libs/observability-server-ts/sync-performance-alerts';
import { SYNC_PERFORMANCE_TARGETS } from '@pkgs/observability-root-shared-ts/metric-contract';

test('every proposed target has paired-window burn and low-traffic alerts, never an absence alert', () => {
  const rules = syncPerformanceAlerts();
  expect(new Set(rules.map((rule) => rule.key)).size).toBe(rules.length);
  expect(rules).toHaveLength(6);
  for (const target of SYNC_PERFORMANCE_TARGETS) {
    for (const rule of rules) {
      expect(rule.expr).toContain(`app_sync_target="${target.id}"`);
      expect(rule.expr).toContain(`"app_sync_target", "${target.id}", "", ""`);
      expect(rule.slice_label).toBe('app_sync_target');
    }
    const fast = rules.find((rule) => rule.name.endsWith('fast-burn'))!;
    expect(fast.expr).toContain('app_outcome!="unknown"');
    expect(
      rules.find((rule) => rule.name.endsWith('uncertain-evidence'))?.expr
    ).toContain('app_outcome="unknown"');
    expect(fast.expr).toContain('[1h]');
    expect(fast.expr).toContain('[5m]');
    expect(fast.expr).toContain('14.4');
    expect(fast.expr).toContain('>= 20');
    expect(fast.expr).toContain('__ENVIRONMENT__');
    for (const rule of rules) expect(rule.expr).not.toContain('absent');
  }
});

test.each([
  ['fast-burn', 'critical', 'page'],
  ['slow-burn', 'critical', 'page'],
  ['daily-burn', 'warning', 'push'],
  ['budget-drift', 'warning', 'push'],
  ['uncertain-evidence', 'warning', 'push'],
  ['low-traffic', 'warning', 'push'],
])(
  '%s preserves delivery, timing and the target in each alert',
  (kind, severity, route) => {
    const rule = syncPerformanceAlerts().find(
      (candidate) => candidate.name === `sync-target-${kind}`
    );
    expect(rule).toMatchObject({ severity, route, for: '2m' });
    expect(rule?.summary).toContain('{{ index $labels "app_sync_target" }}');
  }
);
