import { describe } from '@pkgs/ui-testing';

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

  await alice.space.createSpace();

  await bob.space.openTab();
  await bob.space.expectLobbyCard(aliceUsername);
  await bob.space.openLobbyCard(aliceUsername);
  await bob.space.joinFromPrompt();

  return { alice, bob };
}

describe('space end', (ctx) => {
  ctx.test('host ends; guest sees ended state', async () => {
    await using sim = await openSim('space-end', ctx);
    const { alice, bob } = await setupBothInActiveSpace(sim);

    await alice.space.reenterActiveSpace(aliceUsername);
    await alice.space.endSpace();

    await bob.space.expectLobbyCardGone(aliceUsername);
  });
});
