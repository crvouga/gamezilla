import { expect, test } from 'bun:test';
import { contentDraftTitle } from '@libs/game-puzzle-harness-ts/content-observations';
import { createContentThroughScreen } from '@libs/game-puzzle-harness-ts/content-screen-actions';
import { contentSystem } from '@libs/game-puzzle-harness-ts/content-system';
import { contentDeviceOffline } from '@libs/game-puzzle-harness-ts/offline-actions';

test('an empty offline content library still opens its private builder', async () => {
  // regression: sync-connectivity-status-stays-online
  await using run = await contentSystem.run({ seed: '1bf9f041655beb8f' });
  await run.apply(contentDeviceOffline, 'alice:phone');
  await run.apply(createContentThroughScreen, 'alice:phone', 'River');
  expect(await run.read(contentDraftTitle, 'alice:phone')).toBe('River');
});
