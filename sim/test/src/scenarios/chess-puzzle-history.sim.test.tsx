import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../drivers/app-driver';
import { SIM_CHESS_PUZZLE_IDS } from '../fixtures/chess-puzzles';
import { aliceCreds } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('chess puzzle history', (ctx) => {
  ctx.test(
    'solved puzzle appears in stats game log and opens review',
    async () => {
      await using sim = await openSim('chess-puzzle-history', ctx);

      const alice = await AppDriver.forActor(sim, 'alice');
      await alice.auth.signInWithDev(aliceCreds);
      await alice.auth.returnToTabs();

      await alice.space.createSpace();
      await alice.chess.openPuzzleFromSpace();
      await alice.chess.playUntilSolved();
      await alice.chess.expectSolved();

      await alice.chess.openStats();
      const puzzleId =
        await alice.chess.findVisibleGameLogPuzzleId(SIM_CHESS_PUZZLE_IDS);
      await alice.chess.expectGameLogEntry(puzzleId);
      await alice.chess.openReview(puzzleId);
      await alice.chess.expectMoveHistoryVisible();
    },
    90_000
  );
});
