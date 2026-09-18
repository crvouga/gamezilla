import { describe, expect, test } from 'bun:test';
import { Handles } from '@libs/test-ids';
import {
  createSpace,
  isEmptyPoolVisible,
  partition,
  readActivePuzzleId,
  restoreNetwork,
  returnToTabs,
  signInWithGoogle,
  uiOp,
  visible,
} from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

const tap = (actorId: string, handle: string) => ({
  actorId,
  op: 'tap',
  path: [handle],
  extra: { timeoutMs: 15_000 },
});

/**
 * A fresh device that goes offline before ever opening the puzzle feed has no
 * local pool. The play screen must say so instead of spinning forever, and
 * recover on its own once the network is back.
 */
describe('chess puzzle offline', () => {
  test('offline with no local pool shows the offline block; reconnect recovers', async () => {
    await using s = await openSim('chess-puzzle-offline');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');

    await s.apply(partition, 'alice');
    // Drive the menu by hand: `openPuzzleFromSpace` waits for a playable board.
    await s.until((surf) => visible(surf, 'alice', [Handles.gameMenuChess]), {
      maxMs: 15_000,
    });
    await s.apply(uiOp, tap('alice', Handles.gameMenuChess));
    await s.until((surf) => visible(surf, 'alice', [Handles.chessMenuPuzzle]), {
      maxMs: 15_000,
    });
    await s.apply(uiOp, tap('alice', Handles.chessMenuPuzzle));

    await s.until((surf) => isEmptyPoolVisible(surf, 'alice'), {
      maxMs: 15_000,
      stepMs: 250,
    });
    expect(await s.read(readActivePuzzleId, 'alice')).toBeNull();

    await s.apply(restoreNetwork);
    await s.until(
      async (surf) => (await readActivePuzzleId(surf, 'alice')) !== null,
      { maxMs: 30_000, stepMs: 250 }
    );
  });
});
