import { expect, test } from 'bun:test';
import { arrangeContentDraft } from '@libs/game-puzzle-harness-ts/content-actions';
import { contentDiscoverable } from '@libs/game-puzzle-harness-ts/content-observations';
import { contentEditionTitles } from '@libs/game-puzzle-harness-ts/content-publication-observations';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { publishThroughScreen } from '@libs/game-puzzle-harness-ts/publication-screen-actions';

// regression: puzzle-publication-click-before-ready
test('a cold publication screen waits for the saved copy before publishing River', async () => {
  await using run = await contentSystem.run({ seed: 'fc527d55f5afd7c5' });
  await run.apply(arrangeContentDraft, 'alice:phone', {
    title: 'River',
    valid: true,
  });
  await run.apply(publishThroughScreen);
  expect(
    await run.until((s) => contentDiscoverable(s, 'bob:phone', 'River'), {
      pred: Boolean,
      maxMs: 5_000,
    })
  ).toBe(true);
  expect(await run.read(contentEditionTitles)).toContain('River');
});
