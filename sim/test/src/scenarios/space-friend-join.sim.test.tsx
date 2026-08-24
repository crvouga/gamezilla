import { describe, test } from '@jest/globals';

import { aliceUsername } from '../fixtures/fixtures';
import { setupFriendsPair } from '../fixtures/setup-friends-pair';
import { openSim } from '../setup/open-sim';

describe('space friend join', () => {
  test('host creates; friend joins from lobby card', async () => {
    await using sim = await openSim('space-friend-join');
    const { alice, bob } = await setupFriendsPair(sim);

    await alice.space.createSpace();

    await bob.space.openTab();
    await bob.space.expectLobbyCard(aliceUsername);
    await bob.space.openLobbyCard(aliceUsername);
    await bob.space.joinFromPrompt();
    await bob.space.expectActiveSpace();
  }, 180_000);
});
