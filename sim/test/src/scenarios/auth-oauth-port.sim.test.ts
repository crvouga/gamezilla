import { describe, expect, test } from '@jest/globals';

import { devOauthSignIn, oauthTokenLength } from '../scenario';
import { openSim } from '../setup/open-sim';

describe('auth oauth port', () => {
  test('dev sign-in via in-process openAuthSession', async () => {
    await using run = await openSim('auth-oauth-port');
    await run.apply(devOauthSignIn, 'alice');
    const length = await run.observe(oauthTokenLength);
    expect(length).not.toBeNull();
    expect(length ?? 0).toBeGreaterThan(0);
  });
});
