import { expect } from 'bun:test';
import { Then, When } from '@libs/harness-ts/define';
import { continueSyntheticActivity } from '@libs/synthetic-population-harness-ts/ongoing-activity-actions';
import { syntheticBoardOf } from '@libs/synthetic-population-harness-ts/synthetic-user-reads';
import { recallContinuity, rememberContinuity } from './continuity-memo';

When('{string} continues its current activity', async (w, _name: string) => {
  await rememberContinuity(w);
  await w.s.apply(continueSyntheticActivity);
});
Then('{string} has a multiplayer result', async (w, name: string) => {
  const before = recallContinuity(w);
  const after = await w.s.read(syntheticBoardOf, name);
  expect(after.gameId).toBe(before.board.gameId);
  expect(['white', 'black', 'draw']).toContain(after.outcome ?? '');
  expect(after.announcement).toBeTruthy();
});
