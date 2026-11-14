import { expect, test } from 'bun:test';
import { arrangePersonalAttempt } from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import {
  changeGameRules,
  updateAppFromAttempt,
} from '@libs/game-puzzle-harness-ts/edition-rules-actions';

// A saved attempt under rules this app lacks leads to updating the app from
// the attempt's own notice, with no unusable board or commands beside it.
test('a rules-changed attempt asks the app to update from its notice', async () => {
  await using run = await contentSystem.run({ seed: '9c41d2be07a35f16' });
  await run.apply(arrangePersonalAttempt, { title: 'River' });
  await run.apply(changeGameRules);
  await run.apply(updateAppFromAttempt, 'bob:phone');
  const notice = (key: string) => run.read((s) => s.notices.get(key));
  expect(await notice('rules-changed-shows-board')).toBe('false');
  expect(await notice('rules-changed-update-requests')).toBe('1');
});
