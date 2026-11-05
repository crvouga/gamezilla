import { expect, test } from 'bun:test';
import { observeAttemptAdoption } from '@libs/game-puzzle-harness-ts/attempt-adoption-actions';
import { arrangePersonalAttempt } from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';

// regression: puzzle-position-saved-before-head-adopted
test('a saved position does not enable the next move until its head is displayed', async () => {
  await using run = await contentSystem.run({ seed: 'f1dd5ec2c3fbf35d' });
  await run.apply(arrangePersonalAttempt, { title: 'River', fresh: true });
  await run.apply(observeAttemptAdoption, 'bob:phone');
  expect(await run.read((s) => s.notices.get('attempt-waits-for-head'))).toBe(
    'true'
  );
  expect(
    await run.read((s) => s.notices.get('attempt-continued-from-saved-head'))
  ).toBe('true');
});
