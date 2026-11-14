import { expect, test } from 'bun:test';
import { arrangePersonalAttempt } from '@libs/game-puzzle-harness-ts/attempt-fixtures';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { restartUnopenableAttempt } from '@libs/game-puzzle-harness-ts/unopenable-restart-actions';

// A saved position this device cannot open is recovered from the attempt's
// own screen: Restart from the beginning, confirm, Play it, and a new
// attempt plays on its board while the earlier one stays kept.
test('an unopenable saved position restarts into a playable new attempt', async () => {
  await using run = await contentSystem.run({ seed: '5f0e2c7a91d34b68' });
  await run.apply(arrangePersonalAttempt, { title: 'River' });
  await run.apply(restartUnopenableAttempt, 'bob:phone');
  const notice = (key: string) => run.read((s) => s.notices.get(key));
  expect(await notice('unopenable-offers-moves')).toBe('false');
  expect(await notice('unopenable-restarted-attempt')).toBeTruthy();
  expect(await notice('unopenable-earlier-kept')).toBe('true');
  expect(await notice('unopenable-restart-same-puzzle')).toBe('true');
});
