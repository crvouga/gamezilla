/**
 * Smart monkey: weighted random walk over `defineAction` pool actions,
 * asserting standing properties at every checkpoint.
 */

import { describe, expect, test } from 'bun:test';
import { PRODUCT_POOL_ACTIONS } from '@libs/sim-harness/system/pool-actions';
import { openSim } from './support/open-product-sim';

describe('product walk', () => {
  test('randomActions over defineAction pool holds properties', async () => {
    await using s = await openSim('product-walk');
    const w = await s.randomActions({
      actions: PRODUCT_POOL_ACTIONS,
      steps: 24,
      time: { weight: 1, minMs: 0, maxMs: 50 },
    });
    expect(w.violations).toEqual([]);
    expect(w.count).toBeGreaterThan(0);
    expect(w.coverage.actions['spawnActor'] ?? 0).toBeGreaterThan(0);
  });
});
