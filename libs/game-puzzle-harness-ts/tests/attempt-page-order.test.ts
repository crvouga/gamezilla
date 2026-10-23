import { expect, test } from 'bun:test';
import {
  loadEarlierAttemptsThroughScreen,
  seedEqualTimeAttempts,
} from '@libs/game-puzzle-harness-ts/attempt-page-actions';
import {
  arrangeContentDraft,
  contentClient,
} from '@libs/game-puzzle-harness-ts/content-actions';
import { publishContentDraft } from '@libs/game-puzzle-harness-ts/content-publication-actions';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { readAttemptLibrary } from '@libs/game-puzzle-shared-ts/attempt-library';

test('equal-time attempts use the same cursor order in SQLite and the server', async () => {
  // regression: puzzle-attempt-page-equal-time-gap
  await using run = await contentSystem.run({
    seed: 'equal-time-attempt-page',
    args: { initialContent: false },
  });
  await run.apply(arrangeContentDraft, 'alice:phone', {
    title: 'River',
    valid: true,
  });
  await run.apply(publishContentDraft, 'alice:phone');
  await run.apply(seedEqualTimeAttempts);
  await run.apply(loadEarlierAttemptsThroughScreen);
  expect(
    await run.read(
      async (s) =>
        (await readAttemptLibrary(contentClient(s, 'bob:phone').db)).attempts
          .length
    )
  ).toBe(35);
});
