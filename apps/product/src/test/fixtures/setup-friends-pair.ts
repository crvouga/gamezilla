import {
  acceptFriendRequest,
  addFriend,
  friendRowVisible,
  openFriendsList,
  returnToTabs,
  searchUsername,
  signInWithGoogle,
} from '../../sim';
import type { openSim } from '../setup/open-sim';
import { aliceUsername, bobUsername } from './fixtures';

type OpenSimResult = Awaited<ReturnType<typeof openSim>>;

/** Sign up alice + bob and establish friendship via UI. */
export async function setupFriendsPair(sim: OpenSimResult): Promise<void> {
  await sim.apply(signInWithGoogle, 'alice');
  await sim.apply(returnToTabs, 'alice');
  await sim.apply(signInWithGoogle, 'bob');
  await sim.apply(returnToTabs, 'bob');

  await sim.apply(searchUsername, 'alice', bobUsername);
  await sim.apply(addFriend, 'alice', bobUsername);
  await sim.apply(acceptFriendRequest, 'bob', aliceUsername);

  await sim.apply(openFriendsList, 'alice');
  await sim.until((s) => friendRowVisible(s, 'alice', bobUsername));
  await sim.apply(returnToTabs, 'alice');
  await sim.apply(openFriendsList, 'bob');
  await sim.until((s) => friendRowVisible(s, 'bob', aliceUsername));
  await sim.apply(returnToTabs, 'bob');
}
