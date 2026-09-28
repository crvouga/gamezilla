import { returnToTabs, signInWithGoogle } from '@libs/harness';
import type { ProductHarness } from '@libs/harness/system/harness';
import { searchUsername } from '@libs/search/harness/search-actions';
import type { Run } from '@pkgs/harness';
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
  harness: Run<ProductHarness>,
  a = 'alice',
  b = 'bob'
): Promise<void> {
  await harness.apply(signInWithGoogle, a);
  await harness.apply(returnToTabs, a);
  await harness.apply(signInWithGoogle, b);
  await harness.apply(returnToTabs, b);

  await harness.apply(searchUsername, a, b);
  await harness.apply(addFriend, a, b);
  await harness.apply(acceptFriendRequest, b, a);

  await harness.apply(openFriendsList, a);
  await harness.until((s) => friendRowVisible(s, a, b));
  await harness.apply(returnToTabs, a);
  await harness.apply(openFriendsList, b);
  await harness.until((s) => friendRowVisible(s, b, a));
  await harness.apply(returnToTabs, b);
}
