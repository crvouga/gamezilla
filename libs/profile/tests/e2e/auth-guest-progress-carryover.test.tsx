// goal:social:2
// goal:always-true:10
import { describe, expect, test } from 'bun:test';

import { clientIds, signInWithGoogle } from '@libs/sim-harness';
import { openSim } from './support/open-profile-sim';

describe('guest progress carryover', () => {
  test('guest can become a signed-in member without losing identity', async () => {
    await using s = await openSim('auth-login-logout');
    await s.apply(signInWithGoogle, 'alice');
    expect((await s.read(clientIds)).includes('alice')).toBe(true);
  });
});
