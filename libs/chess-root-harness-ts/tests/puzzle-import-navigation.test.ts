import { expect, test } from 'bun:test';
import {
  openChessPuzzleDeveloperSettings,
  openChessPuzzleLoader,
} from '@libs/chess-root-harness-ts/puzzle-import-navigation';
import {
  readPuzzleImport,
  startPuzzleLoading,
} from '@libs/chess-root-harness-ts/puzzle-import-ui';
import { joinPuzzleTeam } from '@libs/chess-root-harness-ts/puzzle-import-world';
import { actorUi } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { openHarness } from './open-chess-harness';

// regression: puzzle-import-status-subscription-loop
// regression: puzzle-import-derived-snapshot-loop
// regression: puzzle-import-blocks-request
test('chess developer loader accepts a two-part CSV and leaves its worker available to stop', async () => {
  await using s = await openHarness('puzzle-loader-navigation');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(joinPuzzleTeam, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openChessPuzzleDeveloperSettings, 'alice');
  await s.apply(openChessPuzzleLoader, 'alice');
  expect(
    await s.until((world) => readPuzzleImport(world, 'alice'), {
      pred: (view) => !view.denied,
      maxMs: 15000,
    })
  ).toMatchObject({ status: 'ready', denied: false });
  await s.apply(startPuzzleLoading, 'alice');
  expect(await s.read(readPuzzleImport, 'alice')).toMatchObject({
    status: 'adding',
    stopOffered: true,
    added: 0,
  });
}, 30000);

test('chess developer settings hides puzzle loading when the permission is denied', async () => {
  await using s = await openHarness('puzzle-loader-navigation-denied');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openChessPuzzleDeveloperSettings, 'alice');
  expect(
    await s.read(async (world) =>
      (await actorUi(world, 'alice')).get('chess-developer-puzzles').isVisible()
    )
  ).toBe(false);
}, 30000);
