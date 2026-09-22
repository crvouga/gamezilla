/**
 * Auth with the network going away and coming back: a sign-in that cannot
 * reach the API ends cleanly and works once the device is back online, and
 * signing out offline still signs the device out.
 */

import { describe, expect, test } from 'bun:test';
import {
  abandonSignIn,
  caps,
  partition,
  restoreNetwork,
  signedInAccountOf,
  signInWithApple,
  signInWithGoogle,
  signOut,
  spawnActor,
} from '@libs/sim-harness';
import { Handles } from '@libs/test-ids';
import { signedInAs } from './support/auth-reads';
import { openSim } from './support/open-profile-sim';

describe('auth offline and back online', () => {
  test('a sign-in started offline fails cleanly, then succeeds back online', async () => {
    await using s = await openSim('auth-offline-sign-in');
    await s.apply(spawnActor, 'alice');
    if (!(await s.read(caps)).includes('partition')) return;
    await s.apply(partition, 'alice');
    await s.apply(abandonSignIn, 'alice', 'apple');
    expect(await s.read(signedInAccountOf, 'alice')).toBeNull();
    await s.apply(restoreNetwork);
    await s.apply(signInWithApple, 'alice');
    expect(await signedInAs(s, 'alice')).not.toBeNull();
  });

  test('signing out offline signs this device out', async () => {
    await using s = await openSim('auth-offline-sign-out');
    await s.apply(signInWithGoogle, 'alice');
    await signedInAs(s, 'alice');
    if (!(await s.read(caps)).includes('partition')) return;
    await s.apply(partition, 'alice');
    await s.apply(signOut, 'alice');
    const ui = await s.read((surf) => surf.actors.get('alice')?.ui);
    expect(await ui?.get(Handles.accountSignIn).isVisible()).toBe(true);
    await s.apply(restoreNetwork);
    await s.apply(signInWithGoogle, 'alice');
    expect(await signedInAs(s, 'alice')).not.toBeNull();
  });
});
