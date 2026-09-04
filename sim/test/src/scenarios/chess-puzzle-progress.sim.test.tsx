import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('chess puzzle progress', (ctx) => {
  ctx.test(
    'correct plies update move history; Next loads another puzzle',
    async () => {
      await using sim = await openSim('chess-puzzle-progress', ctx);

      const alice = await AppDriver.forActor(sim, 'alice');
      await alice.auth.signInWithDev(aliceCreds);
      await alice.auth.returnToTabs();

      await alice.space.createSpace();
      await alice.chess.openPuzzleFromSpace();

      await alice.chess.playExpectedMove();
      await alice.chess.expectMoveHistoryVisible();

      await alice.chess.playUntilSolved();
      await alice.chess.expectSolved();

      await alice.chess.tapNext();
      await alice.chess.expectPlayReady();
      await alice.chess.playExpectedMove();
    }
  );
});
