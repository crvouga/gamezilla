import {
  finishPuzzleBy,
  playUntilSolved,
} from '@libs/chess-puzzle-harness/chess-actions';
import { CHESS_GAME_ID } from '@libs/chess-root-harness/chess-playable';
import {
  openGamePuzzles,
  retryGamePuzzle,
} from '@libs/game-session-harness/puzzle-screen';
import { partition, restoreNetwork } from '@libs/harness/actions';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { captureWorlds, sharedWorlds } from '@libs/harness/snapshot-worlds';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { bindStructure } from '@pkgs/alloy-shared/registry';
import { openHarness } from '../open-chess-harness';
import { projectPuzzleProgress } from './puzzle-progress-projection';

const worlds = sharedWorlds('puzzle-progress', () =>
  captureWorlds(
    openHarness,
    [
      {
        name: 'A solver retries an offline first result and another device returns',
        run: async (s, capture) => {
          await s.apply(signInWithGoogle, 'alice');
          await s.apply(createSpace, 'alice');
          await s.apply(openGamePuzzles, 'alice', CHESS_GAME_ID);
          await s.apply(partition, 'alice');
          await s.apply(finishPuzzleBy, 'alice', 'wrongRetrySolve');
          await capture('after the wrong move and the solved retry offline');
          await s.apply(restoreNetwork);
          await capture('after the connection returns');
          await s.apply(retryGamePuzzle, 'alice');
          await s.apply(playUntilSolved, 'alice');
          await capture('after another solved retry');
          await s.apply(signInWithGoogleAsAccount, 'charlie', 'alice');
          await capture('after the account opens on another device');
          await s.apply(signInWithGoogle, 'bob');
          await s.apply(createSpace, 'bob');
          await s.apply(openGamePuzzles, 'bob', CHESS_GAME_ID);
          await s.apply(playUntilSolved, 'bob');
        },
      },
    ],
    projectPuzzleProgress
  )
);

bindStructure({
  spec: 'puzzle-progress',
  snapshots: {
    'server database': async () => (await worlds()).server,
    'device database': async () => (await worlds()).device,
  },
});
