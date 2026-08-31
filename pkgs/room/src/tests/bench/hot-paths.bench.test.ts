import { describe, expect, test } from 'bun:test';

import { createHotPathCases } from './hot-paths-cases';

/**
 * Hang-only CI wrapper — exercises room hot paths without wall-clock budgets.
 */
describe('room hot-path benches (hang-only)', () => {
  test('all cases complete once', async () => {
    const cases = await createHotPathCases();
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      await c.run();
    }
  }, 60_000);
});
