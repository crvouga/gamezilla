import { describe, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('auth login → logout', () => {
  test('first login → logout on the account screen', async () => {
    await using sim = await openSim('auth-login-logout');
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signUpWithEmail(aliceCreds);
    // `signOut` already asserts `authSignedOut`.
    await app.auth.signOut();
  });
});
