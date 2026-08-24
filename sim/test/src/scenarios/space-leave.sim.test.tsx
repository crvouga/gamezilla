import { describe, test } from '@jest/globals';

import { aliceUsername } from '../fixtures/fixtures';
import { setupFriendsPair } from '../fixtures/setup-friends-pair';
import { openSim } from '../setup/open-sim';

async function setupBothInActiveSpace(
  sim: Awaited<ReturnType<typeof openSim>>
): Promise<{
  alice: Awaited<ReturnType<typeof setupFriendsPair>>['alice'];
  bob: Awaited<ReturnType<typeof setupFriendsPair>>['bob'];
}> {
  const { alice, bob } = await setupFriendsPair(sim);

  await alice.resume();
  await alice.space.createSpace();
  await alice.park();

  await bob.resume();
  await bob.space.openTab();
  await bob.space.expectLobbyCard(aliceUsername);
  await bob.space.openLobbyCard(aliceUsername);
  await bob.space.joinFromPrompt();
  await bob.park();

  return { alice, bob };
}

describe('space leave', () => {
  test('guest leaves and host space stays live', async () => {
    await using sim = await openSim('space-leave');
    const { alice, bob } = await setupBothInActiveSpace(sim);

    await bob.resume();
    await bob.space.reenterActiveSpace(aliceUsername);
    await bob.space.leaveSpace();
    await bob.space.ensureLobby();
    await bob.space.expectNotInActiveSpace();
    await bob.space.openLobbyCard(aliceUsername);
    await bob.space.expectJoinPrompt();
    await bob.park();

    await alice.resume();
    await alice.space.reenterActiveSpace(aliceUsername);
    await alice.space.expectActiveSpace();
  }, 180_000);
});
