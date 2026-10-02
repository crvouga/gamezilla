import { backToTabs, signedInAccountOf, signInWithGoogle } from '@libs/harness';
import type { ProductHarness } from '@libs/harness/system/harness';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile/harness/profile-actions';
import { readUsername } from '@libs/profile/harness/profile-ui-reads';
import { searchUsername } from '@libs/search/harness/search-actions';
import type { Run } from '@pkgs/harness';
import { addFriend } from './friends-actions';
import { pendingRequestStored } from './relationship-reads';

export async function prepareNamedFriend(
  harness: Run<ProductHarness>,
  actor: string
): Promise<void> {
  if ((await harness.read(signedInAccountOf, actor)) === null)
    await harness.apply(signInWithGoogle, actor);
  await harness.apply(backToTabs, actor);
  if ((await harness.read(readUsername, actor)) !== actor) {
    await harness.apply(openProfileEdit, actor);
    await harness.apply(setUsername, actor, actor);
  }
}

export async function setupFriendRequest(
  harness: Run<ProductHarness>,
  from: string,
  to: string
): Promise<void> {
  await prepareNamedFriend(harness, from);
  await prepareNamedFriend(harness, to);
  await harness.apply(searchUsername, from, to);
  await harness.apply(addFriend, from, to);
  await harness.until((s) => pendingRequestStored(s, from, to));
}
