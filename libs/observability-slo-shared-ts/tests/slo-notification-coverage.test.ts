import { expect, test } from 'bun:test';
import { silenceRules } from '@libs/observability-slo-shared-ts/companion-alerts';
import { routeOf } from '@libs/observability-slo-shared-ts/slo-alerts';
import { SYNTHETIC_CHECKS } from '@libs/observability-slo-shared-ts/synthetic-checks';
import { objectiveFiles } from './specs';

// regression: slo-silence-healthy-sibling-masks-missing-check
test('every scheduled check has an independent missing-evidence alert', () => {
  const rules = silenceRules(objectiveFiles().map((file) => file.doc));
  for (const check of SYNTHETIC_CHECKS) {
    expect(
      rules.some((rule) => rule.expr.includes(`app_synthetic_check="${check}"`))
    ).toBe(true);
  }
});

// regression: slo-supporting-warning-misses-mobile
test('every objective warning reaches mobile push, including supporting tools', () => {
  for (const tier of [0, 1, 2] as const)
    expect(routeOf('warning', tier)).toBe('push');
});
