import { expect, test } from 'bun:test';
import {
  currentAttemptView,
  ordinaryCompletionTitles,
} from '@libs/game-puzzle-harness-ts/attempt-observations';
import { playTwoStepsThroughScreen } from '@libs/game-puzzle-harness-ts/attempt-screen-actions';
import {
  arrangeContentDraft,
  contentClient,
} from '@libs/game-puzzle-harness-ts/content-actions';
import { publishContentDraft } from '@libs/game-puzzle-harness-ts/content-publication-actions';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { startPublishedThroughScreen } from '@libs/game-puzzle-harness-ts/start-screen-actions';
import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';

test('the shared screen hydrates its requested edition without a global content session', async () => {
  await using run = await contentSystem.run({
    seed: 'scoped-content-entry',
    args: { initialContent: false },
  });
  await run.apply(arrangeContentDraft, 'alice:phone', {
    title: 'River',
    valid: true,
  });
  await run.apply(publishContentDraft, 'alice:phone');
  expect(
    await run.read(
      async (s) =>
        (await readContentLibrary(contentClient(s, 'bob:phone').db)).revisions
    )
  ).toEqual([]);
  await run.apply(startPublishedThroughScreen, 'bob:phone', 'River');
  expect(await run.read(currentAttemptView, 'bob:phone')).toMatchObject({
    title: 'River',
    mode: 'ordinary',
    state: 'count:0',
  });
  await run.apply(playTwoStepsThroughScreen, 'bob:phone');
  expect(await run.read(ordinaryCompletionTitles, 'bob:phone')).toEqual([
    'River',
  ]);
});
