import { AppDriver } from '../drivers/app-driver';
import type { openSim } from '../setup/open-sim';
import { aliceCreds, aliceUsername, bobCreds, bobUsername } from './fixtures';

type OpenSimResult = Awaited<ReturnType<typeof openSim>>;

/** Sign up alice + bob, claim usernames, and establish friendship. */
export async function setupFriendsPair(sim: OpenSimResult): Promise<{
  readonly alice: AppDriver;
  readonly bob: AppDriver;
}> {
  const alice = await AppDriver.forActor(sim, 'alice');
  await alice.auth.signUpWithEmail(aliceCreds);
  await alice.auth.returnToTabs();
  await alice.profile.openEdit();
  await alice.profile.setUsername(aliceUsername);
  await alice.profile.expectUsername(aliceUsername);

  const bob = await AppDriver.forActor(sim, 'bob');
  await bob.auth.signUpWithEmail(bobCreds);
  await bob.auth.returnToTabs();
  await bob.profile.openEdit();
  await bob.profile.setUsername(bobUsername);
  await bob.profile.expectUsername(bobUsername);

  await alice.search.expectUserVisible(bobUsername);
  await alice.search.addFriend(bobUsername);

  await bob.notifications.acceptFriendRequest(aliceUsername);

  await alice.friends.openList();
  await alice.friends.expectFriend(bobUsername);

  await bob.friends.openList();
  await bob.friends.expectFriend(aliceUsername);

  return { alice, bob };
}
