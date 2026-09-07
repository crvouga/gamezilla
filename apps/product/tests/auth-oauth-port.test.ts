import { describe, expect, test } from 'bun:test';
import { devOauthSignIn, oauthTokenLength } from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

describe('auth oauth port', () => {
  test('dev sign-in via in-process openAuthSession', async () => {
    await using s = await openSim('auth-oauth-port');
    await s.apply(devOauthSignIn, 'alice');
    const length = await s.read(oauthTokenLength);
    expect(length).not.toBeNull();
    expect(length ?? 0).toBeGreaterThan(0);
  });
});
