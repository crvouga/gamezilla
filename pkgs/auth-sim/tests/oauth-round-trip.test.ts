import { describe, expect, test } from 'bun:test';
import {
  auth,
  clientBearers,
  invariantViolations,
  oauthApprove,
  oauthStart,
  sessionExchange,
  sessionUser,
  setGoogleFault,
  signOut,
} from '@pkgs/auth-sim';

const CALLBACK = 'gamezilla://sso-callback';

describe('auth sim: sign-in against the simulated provider', () => {
  test('launch → provider screens → callback → session', async () => {
    await using s = await auth.run({ seed: 1 });
    await s.apply(oauthStart, { clientId: 'c0', callbackUrl: CALLBACK });
    await s.apply(oauthApprove, { clientId: 'c0', subject: 'alice' });
    await s.apply(sessionExchange, 'c0');

    const bearers = await s.read(clientBearers);
    const bearer = bearers['c0'];
    expect(typeof bearer).toBe('string');
    expect((bearer ?? '').length).toBeGreaterThan(0);
    expect(await s.read(sessionUser, bearer ?? '')).not.toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('a provider outage leaves the client signed out', async () => {
    await using s = await auth.run({ seed: 2 });
    await s.apply(setGoogleFault, true);
    await s.apply(oauthStart, { clientId: 'c0', callbackUrl: CALLBACK });
    await s.apply(oauthApprove, { clientId: 'c0', subject: 'alice' });
    await s.apply(sessionExchange, 'c0');

    expect((await s.read(clientBearers))['c0']).toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('an untrusted callback URL never yields a session', async () => {
    await using s = await auth.run({ seed: 3 });
    await s.apply(oauthStart, {
      clientId: 'c0',
      callbackUrl: 'https://evil.example/sso',
    });
    await s.apply(oauthApprove, { clientId: 'c0', subject: 'alice' });
    await s.apply(sessionExchange, 'c0');

    expect((await s.read(clientBearers))['c0']).toBeNull();
  });

  test('signing out revokes the session', async () => {
    await using s = await auth.run({ seed: 4 });
    await s.apply(oauthStart, { clientId: 'c0', callbackUrl: CALLBACK });
    await s.apply(oauthApprove, { clientId: 'c0', subject: 'bob' });
    await s.apply(sessionExchange, 'c0');
    const bearer = (await s.read(clientBearers))['c0'] ?? '';
    expect(bearer.length).toBeGreaterThan(0);

    await s.apply(signOut, 'c0');
    expect((await s.read(clientBearers))['c0']).toBeNull();
    expect(await s.read(sessionUser, bearer)).toBeNull();
  });
});
