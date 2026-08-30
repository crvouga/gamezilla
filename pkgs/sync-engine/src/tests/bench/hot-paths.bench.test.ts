import { describe, expect, test } from 'bun:test';

import { createHotPathCases } from './hot-paths-cases';

/**
 * Hang-only CI wrapper — exercises the same hot paths as hot-paths.bench.ts
 * without wall-clock assertions (GHA is too noisy for budgets).
 */
describe('sync-engine hot-path benches (hang-only)', () => {
  test('all cases complete once', async () => {
    const cases = await createHotPathCases();
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      await c.run();
    }
  }, 120_000);
});
