import { expect, test } from 'bun:test';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { contentDeviceOnline } from '@libs/game-puzzle-harness-ts/offline-actions';
import { arrangeOfflineDraft } from '@libs/game-puzzle-harness-ts/offline-fixtures';
import { outcome } from '@pkgs/sync-engine-harness-ts/sync-observations';

// regression: mutation-upload-offline-request-stalls-reconnect
test('the online lifecycle port releases queued content writes without an offline request timeout', async () => {
  await using run = await contentSystem.run({
    seed: 'offline-puzzle-draft-reconnect',
  });
  await run.apply(arrangeOfflineDraft, 'River');
  const result = await run.read((s) => s.lastResult.get('alice:phone'));
  if (result?.ok !== true)
    throw new Error('The offline write did not reach the queue');
  await run.apply(contentDeviceOnline, 'alice:phone');
  expect(
    await run.until((s) => outcome(s, 'alice:phone', result.mutationId), {
      pred: (verdict) => verdict !== null,
      maxMs: 5000,
    })
  ).toBe('confirmed');
});
