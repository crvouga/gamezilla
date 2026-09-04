import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('chess puzzle elo', (ctx) => {
  ctx.test('elo chip is visible before solve and stats elo after', async () => {
    await using sim = await openSim('chess-puzzle-elo', ctx);

    const alice = await AppDriver.forActor(sim, 'alice');
    await alice.auth.signInWithDev(aliceCreds);
    await alice.auth.returnToTabs();

    await alice.space.createSpace();
    await alice.chess.openPuzzleFromSpace();

    const before = await alice.chess.readBoardElo();
    if (before === null || before.trim().length === 0) {
      throw new Error(
        `expected board elo chip text, got ${JSON.stringify(before)}`
      );
    }

    await alice.chess.playUntilSolved();
    await alice.chess.expectSolved();

    await alice.chess.openStats();
    await alice.chess.expectStatsEloVisible();
    const after = await alice.chess.readStatsElo();
    if (after === null || after.trim().length === 0) {
      throw new Error(`expected stats elo text, got ${JSON.stringify(after)}`);
    }
  });
});
