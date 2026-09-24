// goal:works-offline:2
// goal:always-true:1
import { describe, expect, test } from 'bun:test';
import {
  openPuzzleFromSpace,
  playWrongPuzzleMove,
} from '@libs/chess/sim/chess-actions';
import {
  isEmptyPoolVisible,
  readActivePuzzleId,
} from '@libs/chess/sim/chess-puzzle-ui';
import {
  actorLocalSql,
  partition,
  restoreNetwork,
  returnToTabs,
  signInWithGoogle,
  uiOp,
  visible,
} from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { Handles } from '@libs/test-ids';
import { sql } from '@pkgs/sql';
import { openSim } from './support/open-chess-sim';

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
  test('an offline wrong move syncs exactly once after reconnect', async () => {
    await using s = await openSim('chess-puzzle-offline-exactly-once');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    const puzzleId = await s.read(readActivePuzzleId, 'alice');
    if (puzzleId === null) throw new Error('expected an active puzzle');

    await s.apply(partition, 'alice');
    await s.apply(playWrongPuzzleMove, 'alice');

    const localRows = await s.read(async (surf) => {
      const clientSql = actorLocalSql(surf, 'alice');
      if (clientSql === null) throw new Error('missing client SQL');
      return await clientSql.query(sql<{ count: number }>`
        SELECT COUNT(*) AS count
        FROM chess_puzzle_interactions
        WHERE puzzle_id = ${puzzleId} AND kind = 'moved' AND correct IS FALSE
      `);
    });
    expect(localRows[0]?.count ?? 0).toBe(1);

    await s.apply(restoreNetwork);
    await s.until(
      async (surf) => {
        const serverRows = await surf.sim.serverSql.sqlClient.query(
          sql<{ count: number }>`
            SELECT COUNT(*) AS count
            FROM chess_puzzle_interactions
            WHERE puzzle_id = ${puzzleId} AND kind = 'moved' AND correct IS FALSE
          `
        );
        return (serverRows[0]?.count ?? 0) === 1;
      },
      { maxMs: 30_000, stepMs: 250 }
    );
    const serverRows = await s.read((surf) =>
      surf.sim.serverSql.sqlClient.query(sql<{ count: number }>`
        SELECT COUNT(*) AS count
        FROM chess_puzzle_interactions
        WHERE puzzle_id = ${puzzleId} AND kind = 'moved' AND correct IS FALSE
      `)
    );
    expect(serverRows[0]?.count ?? 0).toBe(1);
  });
});
