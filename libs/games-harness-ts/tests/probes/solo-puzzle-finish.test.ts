import { expect, test } from 'bun:test';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import {
  finishGamePuzzleAsAppCloses,
  solveGamePuzzlesDaily,
} from '@libs/game-session-harness-ts/puzzle-finishes';
import { solveKnownPuzzle } from '@libs/game-session-harness-ts/puzzle-moves';
import {
  countDevicePuzzles,
  stockMorePuzzles,
  writeKnownPuzzlePool,
} from '@libs/game-session-harness-ts/puzzle-pool';
import { reopenPuzzleApp } from '@libs/game-session-harness-ts/puzzle-result-recovery';
import {
  moveOnToNextPuzzle,
  openGamePuzzles,
  readPuzzleOnBoard,
  readPuzzleProbe,
} from '@libs/game-session-harness-ts/puzzle-screen';
import {
  partition,
  refreshActorConnection,
  refreshActorQueries,
} from '@libs/harness-ts/actions';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { MarkQuiet } from '@libs/spaces-shared-ts/space-quiet';
import { keyValueRoomClientKeywords } from '@pkgs/room-root-client-ts/keys';
import { KeyValueClientRoomStorage } from '@pkgs/room-root-client-ts/storage';
import { SOLO_COUNT_GAME } from './solo-count-game';

const SYSTEM = gameSystem('solo-finish', [SOLO_COUNT_GAME], {
  knownPuzzles: true,
});

async function readQueuedCommands(s: ProductHarness) {
  const link = await readSpaceLink(s, 'alice');
  if (link === null) throw new Error('Alice has no space');
  const env = await s.harness.client('alice');
  const keys = keyValueRoomClientKeywords(link.slice('/space/'.length));
  return new KeyValueClientRoomStorage(
    env.kv,
    keys.committed,
    keys.queue
  ).loadQueued();
}

// regression: solo-offline-catalogue-progression
test('thirty solo catalogue puzzles can be completed over three offline days', async () => {
  await using s = await openGameHarness(SYSTEM, 'solo-thirty-offline');
  const id = SOLO_COUNT_GAME.shared.id;
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(signInWithGoogleAsAccount, 'alice_phone', 'alice');
  await s.apply(returnToTabs, 'alice_phone');
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', id);
  await s.apply(stockMorePuzzles, id, 30);
  await s.until((surf) => countDevicePuzzles(surf, 'alice', 'solo-count/'), {
    maxMs: 20_000,
    pred: (held) => held > 30,
  });
  await s.apply(partition, 'alice');
  await s.apply(refreshActorConnection, 'alice');
  await s.apply(refreshActorQueries, 'alice');
  try {
    await s.apply(solveGamePuzzlesDaily, 'alice', id, { perDay: 10, days: 3 });
  } catch (cause) {
    const queue = await s.read(readQueuedCommands);
    const pending = {
      count: queue.length,
      lastCommands: queue.slice(-3).map((entry) => entry.payload),
    };
    throw new Error(
      JSON.stringify({
        pending,
        puzzle: await s.read(readPuzzleOnBoard, 'alice'),
        probe: await s.read(readPuzzleProbe, 'alice'),
      }),
      { cause }
    );
  }
  expect((await s.read(readPuzzleProbe, 'alice'))?.status).toBe('solved');
}, 120_000);

// regression: solver-only-finish-on-close-stride
test('a clean finish sent before closing includes both solo actions', async () => {
  await using s = await openGameHarness(SYSTEM, 'solo-close-finish');
  const id = SOLO_COUNT_GAME.shared.id;
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(writeKnownPuzzlePool, id, [{ id: 'solo-count/two-twos' }]);
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', id);
  await s.apply(finishGamePuzzleAsAppCloses, 'alice', id, 'clean');
  await s.apply(reopenPuzzleApp, 'alice', true);
  expect((await s.read(readPuzzleProbe, 'alice'))?.status).toBe('solved');
}, 120_000);

// regression: solo-offline-catalogue-progression
test('two solo catalogue lines with the same supplied position solve without a connection', async () => {
  await using s = await openGameHarness(SYSTEM, 'solo-long-offline');
  const id = SOLO_COUNT_GAME.shared.id;
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(stockMorePuzzles, id, 2);
  await s.apply(writeKnownPuzzlePool, id, [
    { id: 'solo-count/more-0' },
    { id: 'solo-count/more-1' },
  ]);
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', id);
  await s.apply(partition, 'alice');
  await s.apply(solveKnownPuzzle, 'alice', id);
  expect((await s.read(readPuzzleProbe, 'alice'))?.status).toBe('solved');
  await s.apply(moveOnToNextPuzzle, 'alice');
  await s.apply(solveKnownPuzzle, 'alice', id);
  expect((await s.read(readPuzzleProbe, 'alice'))?.status).toBe('solved');
  const queued = await s.read(readQueuedCommands);
  expect(
    queued
      .map((command) => command.payload)
      .filter(MarkQuiet.is)
      .filter((command) => !command.payload.quiet)
  ).toEqual([]);
}, 120_000);
