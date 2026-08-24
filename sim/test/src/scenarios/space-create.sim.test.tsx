import { describe, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds, aliceUsername } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('space create', () => {
  test('host creates a space and sees it in the lobby', async () => {
    await using sim = await openSim('space-create');

    const alice = await AppDriver.forActor(sim, 'alice');
    await alice.auth.signUpWithEmail(aliceCreds);
    await alice.auth.returnToTabs();
    await alice.profile.openEdit();
    await alice.profile.setUsername(aliceUsername);
    await alice.profile.expectUsername(aliceUsername);

    await alice.space.createSpace();
    await alice.space.returnToLobby();
    await alice.space.expectLobbyCard(aliceUsername);
  }, 180_000);
});
