import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../src/drivers/app-driver';
import { aliceCreds } from '../src/fixtures/fixtures';
import { openSim } from '../src/setup/open-sim';

describe('auth login → logout', (ctx) => {
  ctx.test('first login → logout on the account screen', async () => {
    await using sim = await openSim('auth-login-logout', ctx);
    const app = await AppDriver.forActor(sim, 'alice');
    await app.auth.signInWithDev(aliceCreds);
    await app.auth.signOut();
  });
});
