import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness-ts/profile-actions';
import { readProfileTabUsername } from '@libs/profile-harness-ts/profile-ui-reads';
import { searchUsername } from '@libs/search-harness-ts/search-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { addFriend } from './friends-actions';
import { pendingRequestStored } from './relationship-reads';

export async function prepareNamedFriend(
  harness: Pick<Run<ProductHarness>, 'read' | 'apply'>,
  actor: string
): Promise<void> {
  if ((await harness.read(signedInAccountOf, actor)) === null)
    await harness.apply(signInWithGoogle, actor);
  await harness.apply(backToTabs, actor);
  // regression: named-friend-offline-profile-read
  if ((await harness.read(readProfileTabUsername, actor)) !== actor) {
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
