import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../src/drivers/app-driver';
import { aliceCreds } from '../src/fixtures/fixtures';
import { openSim } from '../src/setup/open-sim';

describe('chess puzzle play', (ctx) => {
  ctx.test('host solves a seeded mate-in-1 via board drag', async () => {
    await using sim = await openSim('chess-puzzle-play', ctx);

    const alice = await AppDriver.forActor(sim, 'alice');
    await alice.auth.signInWithDev(aliceCreds);
    await alice.auth.returnToTabs();

    await alice.space.createSpace();
    await alice.chess.openPuzzleFromSpace();
    await alice.chess.playUntilSolved();
    await alice.chess.expectSolved();
  });
});
