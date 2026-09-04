import { AppDriver } from '../../drivers/app-driver';
import { aliceUsername } from '../../fixtures/fixtures';
import type { OpenSim } from '../../setup/open-sim';
import { buildFriendsPair } from './friends-pair';

/** Friends in an active space (alice host, bob joined). */
export async function buildBothInSpace(sim: OpenSim): Promise<void> {
  await buildFriendsPair(sim);
  const alice = await AppDriver.forActor(sim, 'alice');
  const bob = await AppDriver.forActor(sim, 'bob');

  await alice.space.createSpace();
  await bob.space.openTab();
  await bob.space.expectLobbyCard(aliceUsername);
  await bob.space.openLobbyCard(aliceUsername);
  await bob.space.joinFromPrompt();
}
