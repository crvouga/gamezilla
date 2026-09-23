import { describe, expect, test } from 'bun:test';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';
import { appleCallback, appleLogin } from './apple-support';
import { aliceIdentity, applied, login, query } from './support';

describe('Apple identity', () => {
  for (const privateEmail of [false, true]) {
    for (const first of ['apple', 'google'] as const) {
      test(`APPLE-001 ${first} first, hide-email=${privateEmail}, explicit linking preserves profile`, async () => {
        await using s = await acceptanceApi.run({ seed: 120 });
        const apple = {
          sub: 'apple-one',
          email: privateEmail
            ? 'relay@privaterelay.appleid.com'
            : aliceIdentity.email,
          privateEmail,
        };
        const owner =
          first === 'apple'
            ? await appleLogin(s, 1, apple)
            : await login(s, 1, aliceIdentity);
        await applied(s, owner, 'claimUsername', { username: 'apple_owner' });
        const before = await query(s, owner, 'ownProfile');
        const linked =
          first === 'apple'
            ? await login(s, 1, aliceIdentity, owner)
            : await appleLogin(s, 1, apple, owner);
        expect(linked.accountId).toBe(owner.accountId);
        // Apple may omit email/name after first authorization. Subject is the key.
        const returning = await appleLogin(s, 2, { sub: apple.sub });
        expect(returning.accountId).toBe(owner.accountId);
        expect(await query(s, returning, 'ownProfile')).toEqual(before);
        expect((await login(s, 3, aliceIdentity)).accountId).toBe(
          owner.accountId
        );
      });
    }
  }

  test('APPLE-002 two Apple and two Google logins resolve one account after explicit links', async () => {
    await using s = await acceptanceApi.run({ seed: 121 });
    const owner = await appleLogin(s, 1, {
      sub: 'apple-one',
      email: 'relay@privaterelay.appleid.com',
      privateEmail: true,
    });
    const googleTwo = { sub: 'google-two', email: null };
    for (const identity of [aliceIdentity, googleTwo])
      expect((await login(s, 1, identity, owner)).accountId).toBe(
        owner.accountId
      );
    expect(
      (
        await appleLogin(
          s,
          1,
          { sub: 'apple-two', email: 'second@example.test' },
          owner
        )
      ).accountId
    ).toBe(owner.accountId);
    for (const sub of ['apple-one', 'apple-two'])
      expect((await appleLogin(s, 2, { sub })).accountId).toBe(owner.accountId);
    for (const identity of [aliceIdentity, googleTwo])
      expect((await login(s, 3, identity)).accountId).toBe(owner.accountId);
  });

  for (const claims of [
    { aud: 'other-app' },
    { iss: 'https://evil.test' },
    { exp: 1 },
    { nonce: 'wrong' },
    { sub: '' },
  ]) {
    test(`APPLE-003 rejects signed token with invalid claims ${JSON.stringify(claims)}`, async () => {
      await using s = await acceptanceApi.run({ seed: 122 });
      const result = await appleCallback(s, { sub: 'apple-one' }, { claims });
      expect(result.status).toBe(400);
      expect(result.headers['location']).toBeUndefined();
    });
  }

  test('APPLE-005 the same email on Apple and Google stays two accounts until linked', async () => {
    await using s = await acceptanceApi.run({ seed: 124 });
    const apple = await appleLogin(s, 1, {
      sub: 'apple-shared-email',
      email: aliceIdentity.email,
      privateEmail: false,
    });
    const google = await login(s, 2, aliceIdentity);
    expect(google.accountId).not.toBe(apple.accountId);
    const linked = await login(s, 1, aliceIdentity, apple);
    expect(linked.accountId).toBe(apple.accountId);
    expect(
      (await appleLogin(s, 3, { sub: 'apple-shared-email' })).accountId
    ).toBe(apple.accountId);
  });

  test('APPLE-004 invalid signature never creates an authenticated session', async () => {
    await using s = await acceptanceApi.run({ seed: 123 });
    const result = await appleCallback(
      s,
      { sub: 'apple-one' },
      { tamper: true }
    );
    expect(result.status).toBe(400);
    expect(result.headers['location']).toBeUndefined();
  });
});
