/**
 * Property-based exploratory testing: `system.explore` runs episodes of
 * `randomActions` over the product `defineAction` pool, shrinks failures.
 */

import { describe, expect, test } from 'bun:test';
import { APP_SYSTEM } from '@libs/runtime/sim/app-composition';
import { ensureNodeLocalStoragePolyfill } from '@libs/sim-harness/open-sim/node-local-storage-polyfill';
import { PRODUCT_POOL_ACTIONS } from '@libs/sim-harness/system/pool-actions';

describe('product explore', () => {
  test(
    'explore episodes over defineAction pool hold properties',
    async () => {
      ensureNodeLocalStoragePolyfill();
      const report = await APP_SYSTEM.explore({
        seed: 42,
        episodes: 3,
        steps: 16,
        actions: PRODUCT_POOL_ACTIONS,
        time: { weight: 1, minMs: 0, maxMs: 40 },
        stopOnViolation: true,
      });
      expect(report.failures.map((f) => f.error)).toEqual([]);
      expect(report.ok).toBe(true);
      expect(report.coverage.actions['spawnActor'] ?? 0).toBeGreaterThan(0);
    },
    { timeout: 300_000 }
  );
});
