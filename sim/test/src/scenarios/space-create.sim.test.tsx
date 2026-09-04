import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds, aliceUsername } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('space create', (ctx) => {
  ctx.test('host creates a space and sees it in the lobby', async () => {
    await using sim = await openSim('space-create', ctx);

    const alice = await AppDriver.forActor(sim, 'alice');
    await alice.auth.signInWithDev(aliceCreds);
    await alice.auth.returnToTabs();

    await alice.space.createSpace();
    await alice.space.returnToLobby();
    await alice.space.expectLobbyCard(aliceUsername);
  });
});
