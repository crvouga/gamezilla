import { describe, expect, test } from '@jest/globals';

import { devOauthSignIn, oauthTokenLength } from '../scenario';
import { openSim } from '../setup/open-sim';

describe('auth oauth port', () => {
  test('dev sign-in via in-process openAuthSession', async () => {
    await using s = await openSim('auth-oauth-port');
    await s.apply(devOauthSignIn, 'alice');
    const length = await s.observe(oauthTokenLength);
    expect(length).not.toBeNull();
    expect(length ?? 0).toBeGreaterThan(0);
  });
});
