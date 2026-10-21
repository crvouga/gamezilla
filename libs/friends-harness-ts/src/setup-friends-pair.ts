import { returnToTabs } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { acceptFriendRequest, openFriendsList } from './friends-actions';
import { friendRowVisible } from './friends-ui-reads';
import { setupFriendRequest } from './setup-friend-request';

/**
 * Sign up two people and establish their friendship via UI. A signed-in
 * actor's username is their actor id, so `a` / `b` are both.
 */
export async function setupFriendsPair(
  harness: Run<ProductHarness>,
  a = 'alice',
  b = 'bob'
): Promise<void> {
  await setupFriendRequest(harness, a, b);
  await harness.apply(acceptFriendRequest, b, a);

  await harness.apply(openFriendsList, a);
  await harness.until((s) => friendRowVisible(s, a, b));
  await harness.apply(returnToTabs, a);
  await harness.apply(openFriendsList, b);
  await harness.until((s) => friendRowVisible(s, b, a));
  await harness.apply(returnToTabs, b);
}
