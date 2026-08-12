import { describe, test } from '@jest/globals';

import { AppDriver } from '../harness/app-driver';
import { aliceCreds } from '../harness/fixtures';
import { openSim } from '../harness/open-sim';

describe('auth login → logout', () => {
  test('first login → logout on the account screen', async () => {
    await using sim = await openSim('auth-login-logout');
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signUpWithEmail(aliceCreds);
    await app.auth.signOut();
    await app.auth.expectSignedOut();
  });
});
