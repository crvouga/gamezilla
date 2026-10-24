import { expect, test } from 'bun:test';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { arrangePackDraft } from '@libs/game-puzzle-harness-ts/pack-actions';
import { previewDuringPackReorder } from '@libs/game-puzzle-harness-ts/pack-workspace-actions';

test('preview cannot unmount the pack editor while its chosen order is being saved', async () => {
  // regression: puzzle-pack-preview-drops-pending-order
  await using run = await contentSystem.run({
    seed: 'pack-preview-during-reorder',
  });
  await run.apply(arrangePackDraft, {
    title: 'Rivers',
    titles: ['River', 'Valley'],
  });
  await run.apply(previewDuringPackReorder);
  expect(await run.read((s) => s.notices.get('pack-preview-pending'))).toBe(
    'true'
  );
});
