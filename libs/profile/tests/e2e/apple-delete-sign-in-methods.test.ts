/**
 * Apple deleting a connected account reaches the person's device on its own:
 * the account screen drops Apple without anyone signing in again or removing
 * a method on that device.
 */

import { describe, expect, test } from 'bun:test';
import {
  appleDeletesAccount,
  connectSignInMethod,
  signInMethodsShown,
  signInWithGoogle,
} from '@libs/sim-harness';

import { openSim } from './support/open-profile-sim';

/** Well under the 60 s session re-check: the change is pushed, not polled. */
const PUSHED_WITHIN_MS = 20_000;

describe('a provider-side Apple deletion', () => {
  // regression: apple-delete-stale-sign-in-methods
  test('leaves the device listing Google as the only sign-in method', async () => {
    await using s = await openSim('apple-delete-sign-in-methods');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(connectSignInMethod, 'alice', 'apple', { account: 'icloud' });
    await s.until((sim) => signInMethodsShown(sim, 'alice'), {
      pred: (shown) => shown?.join(',') === 'apple,google',
      maxMs: PUSHED_WITHIN_MS,
    });

    await s.apply(appleDeletesAccount, 'alice', 'icloud');

    const shown = await s.until((sim) => signInMethodsShown(sim, 'alice'), {
      pred: (methods) => methods?.join(',') === 'google',
      maxMs: PUSHED_WITHIN_MS,
    });
    expect(shown).toEqual(['google']);
  });
});
