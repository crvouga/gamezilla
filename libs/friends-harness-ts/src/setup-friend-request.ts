import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { actorUsername } from '@libs/harness-ts/run-scope';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness-ts/profile-actions';
import {
  nameEveryoneSeesOf,
  readProfileTabUsername,
} from '@libs/profile-harness-ts/profile-ui-reads';
import { searchUsername } from '@libs/search-harness-ts/search-actions';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { addFriend } from './friends-actions';
import { pendingRequestStored } from './relationship-reads';

/** The username `actor` claims in this run. */
export function actorUsernameOf(
  s: ProductHarness,
  actor: string
): Promise<string> {
  return Promise.resolve(actorUsername(s, actor));
}

export async function prepareNamedFriend(
  harness: Pick<Run<ProductHarness>, 'read' | 'apply'>,
  actor: string
): Promise<void> {
  if ((await harness.read(signedInAccountOf, actor)) === null)
    await harness.apply(signInWithGoogle, actor);
  await harness.apply(backToTabs, actor);
  // regression: named-friend-offline-profile-read
  // On a shared stack the name carries the run's tag: another scenario's
  // Alice may already hold the bare one.
  const username = await harness.read(actorUsernameOf, actor);
  if ((await harness.read(readProfileTabUsername, actor)) !== username) {
    await harness.apply(openProfileEdit, actor);
    await harness.apply(setUsername, actor, username);
  }
}

export async function setupFriendRequest(
  harness: Run<ProductHarness>,
  from: string,
  to: string
): Promise<void> {
  for (const actor of [from, to]) {
    await prepareNamedFriend(harness, actor);
    const username = await harness.read(actorUsernameOf, actor);
    // The app accepts its local rename before search and inbox cards can
    // see it. Both read the shared profile by the time the request is sent.
    await harness.until((s) => nameEveryoneSeesOf(s, actor), {
      pred: (sharedName) => sharedName === username,
      maxMs: 10_000,
    });
  }
  await harness.apply(searchUsername, from, to);
  await harness.apply(addFriend, from, to);
  await harness.until((s) => pendingRequestStored(s, from, to));
}
