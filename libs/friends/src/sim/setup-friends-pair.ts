import { searchUsername } from '@libs/search/sim/search-actions';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import type { Run } from '@pkgs/sim';
import {
  acceptFriendRequest,
  addFriend,
  openFriendsList,
} from './friends-actions';
import { friendRowVisible } from './friends-ui-reads';

/** Sign up alice + bob and establish friendship via UI. */
export async function setupFriendsPair(sim: Run<ProductSim>): Promise<void> {
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
