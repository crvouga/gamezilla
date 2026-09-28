/**
 * The scripted accounts run, through the same harness actions the profile
 * steps use.
 */

import {
  appleDeletesAccount,
  focusActor,
  returnToTabs,
  signedOutShown,
  signInWithApple,
  signInWithGoogle,
} from '@libs/harness';
import type { Scenario } from '@libs/harness/alloy/snapshot-worlds';
import type { OpenHarness } from '@libs/harness/open-harness/open-harness';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile/harness/profile-actions';

/** Apple telling the API about a deleted account can take this long to show. */
const SIGNED_OUT_WAIT_MS = 150_000;
/** The device notices within a minute: look every few seconds, not constantly. */
const SIGNED_OUT_STEP_MS = 5_000;

async function signIn(s: OpenHarness, actor: string): Promise<void> {
  await s.apply(signInWithGoogle, actor);
  await s.apply(returnToTabs, actor);
}

async function rename(
  s: OpenHarness,
  actor: string,
  username: string
): Promise<void> {
  await s.apply(focusActor, actor);
  await s.apply(openProfileEdit, actor);
  await s.apply(setUsername, actor, username);
}

/**
 * The one scripted accounts run: what the account-sign-in model's walk does
 * not reach, read at each moment a fact is at stake.
 * - Alice renames herself and Bob takes her old username, while a guest
 *   keeps the one they were given (`UsernamesAreUnique`, `OneAccountPerProfile`);
 * - Bob's account is signed into with Apple alone, then Apple deletes that
 *   Apple account: the account is left with no sign-in method, as Apple tells
 *   the app and once Bob's device has noticed (`SignedIntoAccountsWithASignInMethod`).
 * Connecting and removing sign-in methods, two devices on one account and
 * signing out (here and everywhere) come from the Quint walk.
 */
export const ACCOUNTS_SCENARIO: Scenario = {
  name: 'renames, and an only Apple account deleted at Apple',
  run: async (s, capture) => {
    await s.apply(focusActor, 'guest');
    await signIn(s, 'alice');
    await s.apply(signInWithApple, 'bob', { account: 'icloud' });
    await s.apply(returnToTabs, 'bob');
    await rename(s, 'alice', 'alice_w');
    await rename(s, 'bob', 'alice');
    await capture('Bob took the old username of Alice');
    await s.apply(appleDeletesAccount, 'bob', 'icloud');
    await capture('as Apple tells the app');
    await s.until((h) => signedOutShown(h, 'bob'), {
      pred: (signedOut) => signedOut,
      maxMs: SIGNED_OUT_WAIT_MS,
      stepMs: SIGNED_OUT_STEP_MS,
    });
  },
};
