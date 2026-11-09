import { expect, test } from 'bun:test';
import { routeOf } from '@libs/observability-server-ts/slo-alerts';

// regression: slo-supporting-warning-misses-mobile
test('every objective warning reaches mobile push, including supporting tools', () => {
  for (const tier of [0, 1, 2] as const)
    expect(routeOf('warning', tier)).toBe('push');
});
