import { describe, expect, test } from '@jest/globals';
import {
  createAuthClientAdapter,
  createInMemoryAuthClientStorage,
} from '@pkgs/auth/client';

import { openSim, productOf } from '../setup/open-sim';

describe('auth oauth port', () => {
  test('dev sign-in via in-process openAuthSession', async () => {
    await using sim = await openSim('auth-oauth-port');
    const env = productOf(sim).sim.client('alice');
    const port = createAuthClientAdapter({
      baseURL: env.authBaseURL,
      timers: env.timers,
      fetch: env.server,
      storage: createInMemoryAuthClientStorage(),
      openAuthSession: env.openAuthSession,
      callbackUrl: 'gamezilla://sso-callback',
    });

    await port.signIn('oauth-dev');
    const token = await port.getFreshToken();
    expect(token).not.toBeNull();
    expect(token?.length).toBeGreaterThan(0);
  });
});
