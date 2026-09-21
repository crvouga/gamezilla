// goal:social:1
import { describe, test } from 'bun:test';
import { signInWithGoogle, signOut } from '@libs/sim-harness';
import { openSim } from './support/open-profile-sim';

describe('auth login → logout', () => {
  test('first login → logout on the account screen', async () => {
    await using s = await openSim('auth-login-logout');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(signOut, 'alice');
  });
});
