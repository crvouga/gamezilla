import { describe, test } from 'bun:test';

import { openSim } from '../src/setup/open-sim';
import { signInWithDev, signOut } from '../src/sim';

describe('auth login → logout', () => {
  test('first login → logout on the account screen', async () => {
    await using s = await openSim('auth-login-logout');
    await s.apply(signInWithDev, 'alice');
    await s.apply(signOut, 'alice');
  });
});
