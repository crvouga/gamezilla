import { expect, test } from 'bun:test';
import { createContentDraft } from '@libs/game-puzzle-harness-ts/content-actions';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { outcome } from '@pkgs/sync-engine-harness-ts/sync-observations';

// regression: puzzle-content-harness-unpolled-verdict
test('the content adapter drives a pollable upload verdict to confirmation', async () => {
  await using run = await contentSystem.run({
    seed: 'pollable-content-verdict',
  });
  await run.apply(createContentDraft, 'alice:phone', 'River');
  const result = await run.read((s) => s.lastResult.get('alice:phone'));
  expect(result?.ok).toBe(true);
  if (result?.ok !== true) throw new Error('The fixture mutation was refused');
  expect(
    await run.read((s) => outcome(s, 'alice:phone', result.mutationId))
  ).toBe('confirmed');
});
