import { describe, expect, test } from 'bun:test';
import {
  acceptanceApi,
  providerFault,
  providerIdentity,
} from '@apps/product/sim/acceptance/system';
import {
  aliceIdentity,
  bobIdentity,
  CALLBACK,
  call,
  googleCode,
  headers,
  type Json,
  login,
} from './support';

describe('Auth / session ownership', () => {
  test('AUTH-001 same provider subject on two devices resolves one account', async () => {
    await using s = await acceptanceApi.run({ seed: 101 });
    const a = await login(s, 1, aliceIdentity);
    const b = await login(s, 2, aliceIdentity);
    expect(b.accountId).toBe(a.accountId);
    expect(b.token).not.toBe(a.token);
  });

  for (const email of [
    'alice@example.test',
    null,
    'relay@privaterelay.appleid.com',
  ]) {
    test(`AUTH-002 email=${email}: equal email never grants another subject's account`, async () => {
      await using s = await acceptanceApi.run({ seed: 102 });
      const a = await login(s, 1, { sub: 'one', email });
      const b = await login(s, 2, { sub: 'two', email });
      expect(a.accountId).not.toBe(b.accountId);
    });
  }

  test('AUTH-003 a changed email with the same subject keeps the account', async () => {
    await using s = await acceptanceApi.run({ seed: 103 });
    const a = await login(s, 1, aliceIdentity);
    const b = await login(s, 2, {
      ...aliceIdentity,
      email: 'changed@example.test',
    });
    expect(b.accountId).toBe(a.accountId);
  });

  test('AUTH-004 switching A → B → A on one install preserves both account identities', async () => {
    await using s = await acceptanceApi.run({ seed: 104 });
    const a = await login(s, 1, aliceIdentity);
    const b = await login(s, 1, bobIdentity);
    const again = await login(s, 1, aliceIdentity);
    expect(b.accountId).not.toBe(a.accountId);
    expect(again.accountId).toBe(a.accountId);
  });

  test('AUTH-005 signing out revokes only that device session and is idempotent', async () => {
    await using s = await acceptanceApi.run({ seed: 105 });
    const a = await login(s, 1, aliceIdentity);
    const b = await login(s, 2, aliceIdentity);
    for (let i = 0; i < 2; i++) {
      expect(
        (
          await call(s, {
            path: '/auth/sign-out',
            headers: headers(a),
            body: {},
          })
        ).status
      ).toBe(200);
    }
    expect(
      (
        await call(s, {
          path: '/auth/session',
          method: 'GET',
          headers: headers(a),
        })
      ).status
    ).toBe(401);
    expect(
      (
        await call(s, {
          path: '/auth/session',
          method: 'GET',
          headers: headers(b),
        })
      ).status
    ).toBe(200);
  });

  test('AUTH-006 exchange codes are single use', async () => {
    await using s = await acceptanceApi.run({ seed: 106 });
    const { code } = await googleCode(s, aliceIdentity);
    expect(
      (await call(s, { path: '/auth/session', body: { code } })).status
    ).toBe(200);
    expect(
      (await call(s, { path: '/auth/session', body: { code } })).status
    ).toBe(400);
  });

  for (const callback of [
    'https://evil.test/callback',
    'http://localhost:5173.evil.test/x',
    'javascript:alert(1)',
    '//evil.test/x',
  ]) {
    test(`AUTH-007 rejects redirect ${callback}`, async () => {
      await using s = await acceptanceApi.run({ seed: 107 });
      const result = await call(s, {
        path: `/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(callback)}`,
        method: 'GET',
      });
      expect(result.status).toBe(400);
      expect(result.headers['location']).toBeUndefined();
    });
  }

  for (const fault of [
    'offline',
    'token-503',
    'userinfo-503',
    'malformed-token',
    'malformed-profile',
  ] as const) {
    test(`AUTH-008 ${fault}: fails closed, existing session survives, retry works`, async () => {
      await using s = await acceptanceApi.run({ seed: 108 });
      const a = await login(s, 1, aliceIdentity);
      const launch = await call(s, {
        path: `/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(CALLBACK)}`,
        method: 'GET',
      });
      expect(launch.status).toBe(302);
      const state = new URL(launch.headers['location']!).searchParams.get(
        'state'
      );
      await s.apply(providerFault, fault);
      const failed = await call(s, {
        path: `/auth/callback/google?code=fixture&state=${state}`,
        method: 'GET',
      });
      expect(failed.status).toBe(400);
      expect(failed.headers['location']).toBeUndefined();
      expect((failed.body as Json)['token']).toBeUndefined();
      expect(
        (
          await call(s, {
            path: '/auth/session',
            method: 'GET',
            headers: headers(a),
          })
        ).status
      ).toBe(200);
      await s.apply(providerFault, 'none');
      expect((await login(s, 2, aliceIdentity)).accountId).toBe(a.accountId);
    });
  }

  test('AUTH-009 an unverified email fails closed and does not attach by email', async () => {
    await using s = await acceptanceApi.run({ seed: 109 });
    const owner = await login(s, 1, aliceIdentity);
    await s.apply(providerIdentity, {
      sub: 'unverified',
      email: aliceIdentity.email,
      verified: false,
    });
    const launch = await call(s, {
      path: `/auth/oauth/launch?provider=google&callbackUrl=${encodeURIComponent(CALLBACK)}`,
      method: 'GET',
    });
    expect(launch.status).toBe(302);
    const state = new URL(launch.headers['location']!).searchParams.get(
      'state'
    );
    const failed = await call(s, {
      path: `/auth/callback/google?code=fixture-code&state=${state}`,
      method: 'GET',
    });
    expect(failed.status).toBe(400);
    expect(failed.headers['location']).toBeUndefined();
    const separate = await login(s, 2, {
      sub: 'unverified',
      email: 'other@example.test',
    });
    expect(separate.accountId).not.toBe(owner.accountId);
  });
});
