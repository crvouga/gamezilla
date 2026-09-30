import { describe, expect, test } from 'bun:test';
import { onlineAfterRefresh } from '@libs/spaces/public/answer-connection';

describe('onlineAfterRefresh', () => {
  // regression: journey-host-stuck-on-own-join
  test('answers from the status it has when the sweep never finishes', async () => {
    const online = await onlineAfterRefresh({
      refresh: () => new Promise<void>(() => undefined),
      online: () => true,
      budgetMs: 3_000,
      schedule: (_ms, run) => {
        run();
        return () => undefined;
      },
    });
    expect(online).toBe(true);
  });

  test('uses the sweep when it finishes inside the budget', async () => {
    let cancelled = false;
    const online = await onlineAfterRefresh({
      refresh: () => Promise.resolve(),
      online: () => false,
      budgetMs: 3_000,
      schedule: () => () => {
        cancelled = true;
      },
    });
    expect(online).toBe(false);
    expect(cancelled).toBe(true);
  });
});
