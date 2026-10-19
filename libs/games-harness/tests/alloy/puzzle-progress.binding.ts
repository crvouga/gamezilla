/**
 * `specs/games/puzzle-progress.als` on the product, at each game offering
 * puzzles: a solver retries a first result played offline, the connection
 * returns, they retry a solved puzzle, their account opens on another
 * device, and another solver plays the same game's puzzles. Each game's
 * stored progress is projected on its own (its game log and puzzle rating
 * are its own), every snapshot labelled with the game.
 */

import type { HarnessGame } from '@libs/game-session-harness/harness-game';
import {
  playKnownWrongMove,
  solveKnownPuzzle,
} from '@libs/game-session-harness/puzzle-moves';
import { puzzleNamespaceOfGame } from '@libs/game-session-harness/puzzle-pool';
import {
  openGamePuzzles,
  retryGamePuzzle,
} from '@libs/game-session-harness/puzzle-screen';
import { partition, restoreNetwork } from '@libs/harness/actions';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { StoredWorlds } from '@libs/harness/snapshot-worlds';
import { captureWorlds, sharedWorlds } from '@libs/harness/snapshot-worlds';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { bindStructure } from '@pkgs/alloy-shared/registry';
import { gamesHeldTo, openConformanceHarness } from '../conformance-world';
import { projectPuzzleProgress } from './puzzle-progress-projection';

/** The stored worlds one game's puzzle progress passes through. */
function progressWorlds(game: HarnessGame): Promise<StoredWorlds> {
  const gameId = game.shared.id;
  return captureWorlds(
    openConformanceHarness,
    [
      {
        name: `A solver retries an offline first result and another device returns [${game.label}]`,
        run: async (s, capture) => {
          await s.apply(signInWithGoogle, 'alice');
          await s.apply(createSpace, 'alice');
          await s.apply(openGamePuzzles, 'alice', gameId);
          await s.apply(partition, 'alice');
          await s.apply(playKnownWrongMove, 'alice', gameId);
          await s.apply(retryGamePuzzle, 'alice');
          await s.apply(solveKnownPuzzle, 'alice', gameId);
          await capture('after the wrong move and the solved retry offline');
          await s.apply(restoreNetwork);
          await capture('after the connection returns');
          await s.apply(retryGamePuzzle, 'alice');
          await s.apply(solveKnownPuzzle, 'alice', gameId);
          await capture('after another solved retry');
          await s.apply(signInWithGoogleAsAccount, 'charlie', 'alice');
          await capture('after the account opens on another device');
          await s.apply(signInWithGoogle, 'bob');
          await s.apply(createSpace, 'bob');
          await s.apply(openGamePuzzles, 'bob', gameId);
          await s.apply(solveKnownPuzzle, 'bob', gameId);
        },
      },
    ],
    projectPuzzleProgress(puzzleNamespaceOfGame(game))
  );
}

const worlds = sharedWorlds('puzzle-progress', async () => {
  const server: StoredWorlds['server'][number][] = [];
  const device: StoredWorlds['device'][number][] = [];
  for (const game of gamesHeldTo('specs/games/puzzle-progress.als')) {
    const stored = await progressWorlds(game);
    server.push(...stored.server);
    device.push(...stored.device);
  }
  return { server, device };
});

bindStructure({
  spec: 'puzzle-progress',
  snapshots: {
    'server database, for every game': async () => (await worlds()).server,
    'device database, for every game': async () => (await worlds()).device,
  },
});
