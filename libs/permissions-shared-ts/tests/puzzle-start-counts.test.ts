import { expect, test } from 'bun:test';
import { dailyPuzzleLimitApplicationLayer } from '@libs/permissions-shared-ts/application';

test('the rated puzzle quota reads starts at the daily boundary', async () => {
  // regression: puzzle-quota-start-count-binding
  const decision = dailyPuzzleLimitApplicationLayer();
  const context = {
    decisionId: 'daily-puzzle-limit',
    caseId: 'literal-boundary',
    world: undefined,
  };
  const earlier = {
    'who is asking': 'guest',
    'rated puzzles started today': 0,
    'rated puzzles started before today': 100,
  };
  expect(await decision.decide(earlier, context)).toEqual({
    answer: 'yes',
    reason: 'none',
  });
  expect(
    await decision.decide(
      { ...earlier, 'rated puzzles started today': 20 },
      context
    )
  ).toEqual({ answer: 'no', reason: 'daily puzzle limit reached' });
});
