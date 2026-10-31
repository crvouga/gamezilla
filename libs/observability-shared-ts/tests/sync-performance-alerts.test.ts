import { expect, test } from 'bun:test';
import { syncPerformanceAlerts } from '@libs/observability-shared-ts/slo-alert-rules';
import { SYNC_PERFORMANCE_TARGETS } from '@pkgs/observability-root-shared-ts/metric-contract';

test('every proposed target has paired-window burn, low-traffic and missing-evidence alerts', () => {
  const rules = syncPerformanceAlerts();
  expect(new Set(rules.map((rule) => rule.key)).size).toBe(rules.length);
  for (const target of SYNC_PERFORMANCE_TARGETS) {
    const matching = rules.filter((rule) =>
      rule.name.startsWith(`sync-${target.id}-`)
    );
    expect(matching).toHaveLength(7);
    const fast = matching.find((rule) => rule.name.endsWith('fast-burn'))!;
    expect(fast.expr).toContain('app_outcome!="unknown"');
    expect(
      matching.find((rule) => rule.name.endsWith('uncertain-evidence'))?.expr
    ).toContain('app_outcome="unknown"');
    expect(fast.expr).toContain('[1h]');
    expect(fast.expr).toContain('[5m]');
    expect(fast.expr).toContain('14.4');
    expect(fast.expr).toContain('>= 20');
    expect(fast.expr).toContain('__ENVIRONMENT__');
    expect(
      matching.find((rule) => rule.name.endsWith('missing-evidence'))?.expr
    ).toContain('absent_over_time');
  }
});
