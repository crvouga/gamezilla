import { expect } from 'bun:test';
import { Then, When } from '@libs/harness-ts/define';
import { syntheticContinuity } from '@libs/synthetic-population-harness-ts/continuity-actions';
import { continueSyntheticActivity } from '@libs/synthetic-population-harness-ts/ongoing-activity-actions';
import { recallContinuity, rememberContinuity } from './continuity-memo';

When('{string} continues its current activity', async (w, _name: string) => {
  await rememberContinuity(w);
  await w.s.apply(continueSyntheticActivity);
});
Then('{string} has a multiplayer result', async (w, _name: string) => {
  const before = recallContinuity(w);
  const after = await w.s.read(syntheticContinuity);
  expect(after.board.gameId).toBe(before.board.gameId);
  expect(['white', 'black', 'draw']).toContain(after.board.outcome ?? '');
  expect(after.board.announcement).toBeTruthy();
});
