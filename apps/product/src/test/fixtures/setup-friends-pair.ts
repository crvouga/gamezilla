import {
  acceptFriendRequest,
  addFriend,
  expectFriend,
  openFriendsList,
  returnToTabs,
  searchUsername,
  signInWithDev,
} from '../../sim';
import type { openSim } from '../setup/open-sim';
import { aliceUsername, bobUsername } from './fixtures';

type OpenSimResult = Awaited<ReturnType<typeof openSim>>;

/** Sign up alice + bob and establish friendship via UI. */
export async function setupFriendsPair(sim: OpenSimResult): Promise<void> {
  await sim.apply(signInWithDev, 'alice');
  await sim.apply(returnToTabs, 'alice');
  await sim.apply(signInWithDev, 'bob');
  await sim.apply(returnToTabs, 'bob');

  await sim.apply(searchUsername, 'alice', bobUsername);
  await sim.apply(addFriend, 'alice', bobUsername);
  await sim.apply(acceptFriendRequest, 'bob', aliceUsername);

  await sim.apply(openFriendsList, 'alice');
  await sim.apply(expectFriend, 'alice', bobUsername);
  await sim.apply(returnToTabs, 'alice');
  await sim.apply(openFriendsList, 'bob');
  await sim.apply(expectFriend, 'bob', aliceUsername);
  await sim.apply(returnToTabs, 'bob');
}
