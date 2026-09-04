import { AppDriver } from '../../drivers/app-driver';
import { aliceUsername, bobUsername } from '../../fixtures/fixtures';
import type { OpenSim } from '../../setup/open-sim';
import { buildSignedInPair } from './signed-in-pair';

/** Alice + bob signed in and friends. */
export async function buildFriendsPair(sim: OpenSim): Promise<void> {
  await buildSignedInPair(sim);
  const alice = await AppDriver.forActor(sim, 'alice');
  const bob = await AppDriver.forActor(sim, 'bob');

  await alice.search.expectUserVisible(bobUsername);
  await alice.search.addFriend(bobUsername);
  await bob.notifications.acceptFriendRequest(aliceUsername);

  await alice.friends.openList();
  await alice.friends.expectFriend(bobUsername);
  await bob.friends.openList();
  await bob.friends.expectFriend(aliceUsername);
}
