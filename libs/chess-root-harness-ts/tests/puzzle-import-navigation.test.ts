import { expect, test } from 'bun:test';
import {
  openChessGameChoices,
  openChessPuzzleLoader,
  openChessSettings,
} from '@libs/chess-root-harness-ts/puzzle-import-navigation';
import {
  readPuzzleImport,
  startPuzzleLoading,
} from '@libs/chess-root-harness-ts/puzzle-import-ui';
import { joinPuzzleTeam } from '@libs/chess-root-harness-ts/puzzle-import-world';
import {
  openLoaderPlace,
  readLoaderPosition,
} from '@libs/chess-root-harness-ts/puzzle-loader-places';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { openHarness } from './open-chess-harness';

/** Whether `alice` sees the control `id`. */
async function sees(world: ProductHarness, id: string): Promise<boolean> {
  return (await actorUi(world, 'alice')).get(id).isVisible();
}

/** Press the space's Back. */
const goBack = scenarioAction({
  name: 'goBackInSpace',
  act: async (world, actor: string) => {
    await (await actorUi(world, actor)).get(Handles.navBack).tap();
    await world.session.waitForIdle();
  },
});

// regression: puzzle-import-status-subscription-loop
// regression: puzzle-import-derived-snapshot-loop
// regression: puzzle-import-blocks-request
test('chess developer loader accepts a two-part CSV and leaves its worker available to stop', async () => {
  await using s = await openHarness('puzzle-loader-navigation');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(joinPuzzleTeam, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openChessSettings, 'alice');
  await s.apply(openChessPuzzleLoader, 'alice');
  expect(
    await s.until((world) => readPuzzleImport(world, 'alice'), {
      pred: (view) => !view.denied,
      maxMs: 15000,
    })
  ).toMatchObject({ status: 'ready', denied: false });
  // The loader opens on its hub; the Lichess file has a place of its own
  // behind it, and Back from that place returns to the hub.
  expect(await s.read(readLoaderPosition, 'alice')).toMatchObject({
    place: 'load',
  });
  await s.apply(openLoaderPlace, 'alice', 'source');
  expect(await s.read(readLoaderPosition, 'alice')).toMatchObject({
    place: 'source',
  });
  expect(await s.read(sees, 'puzzle-load-start')).toBe(false);
  await s.apply(openLoaderPlace, 'alice', 'load');
  expect(await s.read(readLoaderPosition, 'alice')).toMatchObject({
    place: 'load',
  });
  await s.apply(startPuzzleLoading, 'alice');
  expect(await s.read(readPuzzleImport, 'alice')).toMatchObject({
    status: 'adding',
    stopOffered: true,
    startOffered: false,
    added: 0,
  });
}, 30000);

// regression: settings-offer-empty-developer-group — a person who may
// not load puzzles was offered Settings, then Developer, to find nothing.
test('chess offers no settings to a person who may not load puzzles', async () => {
  await using s = await openHarness('puzzle-loader-navigation-denied');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openChessGameChoices, 'alice');
  expect(await s.read(sees, Handles.gameChoices)).toBe(true);
  expect(await s.read(sees, 'game-choice-settings')).toBe(false);
  expect(await s.read(sees, 'chess-settings-puzzles')).toBe(false);
}, 30000);

test('Back from chess settings returns to the game menu', async () => {
  await using s = await openHarness('puzzle-loader-navigation-back');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(joinPuzzleTeam, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openChessSettings, 'alice');
  expect(await s.read(sees, 'chess-settings-puzzles')).toBe(true);
  await s.apply(goBack, 'alice');
  expect(await s.read(sees, Handles.gameChoices)).toBe(true);
}, 30000);
