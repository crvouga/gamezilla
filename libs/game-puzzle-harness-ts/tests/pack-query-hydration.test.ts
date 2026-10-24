import { expect, test } from 'bun:test';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { arrangePackDraft } from '@libs/game-puzzle-harness-ts/pack-actions';
import { publishedPackTitles } from '@libs/game-puzzle-harness-ts/pack-observations';

test('pack publication keeps the session snapshot shape stable after an initially empty catalogue', async () => {
  // regression: puzzle-reference-snapshot-shape-changed
  await using run = await contentSystem.run({ seed: '6dc38490d4e9b4e4' });
  await run.apply(arrangePackDraft, {
    title: 'Rivers',
    titles: ['River', 'Valley'],
    published: true,
  });
  expect(await run.read(publishedPackTitles, 'Rivers')).toEqual([
    'River',
    'Valley',
  ]);
});
