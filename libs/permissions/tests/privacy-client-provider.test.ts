import { expect, test } from 'bun:test';
import { dailyPuzzleLimitClientLayer } from '@libs/permissions/root/conformance/client-layers';
import { billingSubscriptionsFixture } from './support/billing-fixture';

test('privacy decisions do not prevent an ordinary quota decision from mounting', async () => {
  // regression: privacy-hook-client-provider
  const layer = dailyPuzzleLimitClientLayer({
    tables: [billingSubscriptionsFixture],
  });
  expect(
    await layer.decide(
      {
        'who is asking': 'guest',
        'rated puzzles started today': 0,
        'rated puzzles started before today': 0,
      },
      {
        decisionId: 'dailyPuzzleLimit',
        caseId: 'guest-zero-use',
        world: undefined,
      }
    )
  ).toEqual({ answer: 'yes', reason: 'none' });
});
