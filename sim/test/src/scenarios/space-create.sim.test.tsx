import { describe, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds, aliceUsername } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('space create', () => {
  test('host creates a space and sees it in the lobby', async () => {
    await using sim = await openSim('space-create');

    const alice = await AppDriver.forActor(sim, 'alice');
    await alice.auth.signInWithDev(aliceCreds);
    await alice.auth.returnToTabs();
    // Signup username matches aliceUsername — ensureProfile already claimed it.

    await alice.space.createSpace();
    await alice.space.returnToLobby();
    await alice.space.expectLobbyCard(aliceUsername);
  }, 30_000);
});
