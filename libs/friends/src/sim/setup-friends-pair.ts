import { searchUsername } from '@libs/search/sim/search-actions';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import type { Run } from '@pkgs/sim';
import {
  acceptFriendRequest,
  addFriend,
  openFriendsList,
} from './friends-actions';
import { friendRowVisible } from './friends-ui-reads';

/**
 * Sign up two people and establish their friendship via UI. A signed-in
 * actor's username is their actor id, so `a` / `b` are both.
 */
export async function setupFriendsPair(
  sim: Run<ProductSim>,
  a = 'alice',
  b = 'bob'
): Promise<void> {
  await sim.apply(signInWithGoogle, a);
  await sim.apply(returnToTabs, a);
  await sim.apply(signInWithGoogle, b);
  await sim.apply(returnToTabs, b);

  await sim.apply(searchUsername, a, b);
  await sim.apply(addFriend, a, b);
  await sim.apply(acceptFriendRequest, b, a);

  await sim.apply(openFriendsList, a);
  await sim.until((s) => friendRowVisible(s, a, b));
  await sim.apply(returnToTabs, a);
  await sim.apply(openFriendsList, b);
  await sim.until((s) => friendRowVisible(s, b, a));
  await sim.apply(returnToTabs, b);
}
