import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('auth login → logout', (ctx) => {
  ctx.test('first login → logout on the account screen', async () => {
    await using sim = await openSim('auth-login-logout', ctx);
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signInWithDev(aliceCreds);
    await app.auth.signOut();
  });
});
