import { describe, expect, test } from 'bun:test';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';
import {
  aliceIdentity,
  applied,
  bobIdentity,
  CALLBACK,
  call,
  headers,
  login,
  query,
} from './support';

describe('Auth / explicit linking and unlinking', () => {
  for (const email of [
    'alice@example.test',
    'second@example.test',
    null,
    'relay@privaterelay.appleid.com',
  ]) {
    test(`LINK-001 link a second Google subject with email=${email} to the authenticated account`, async () => {
      await using s = await acceptanceApi.run({ seed: 110 });
      const owner = await login(s, 1, aliceIdentity);
      await applied(s, owner, 'claimUsername', { username: 'linked_owner' });
      const before = await query(s, owner, 'ownProfile');
      const second = { sub: 'second-google', email };
      const linked = await login(s, 1, second, owner);
      expect(linked.accountId).toBe(owner.accountId);
      expect(await query(s, linked, 'ownProfile')).toEqual(before);
      for (const identity of [aliceIdentity, second]) {
        const fresh = await login(s, 2, identity);
        expect(fresh.accountId).toBe(owner.accountId);
        expect(await query(s, fresh, 'ownProfile')).toEqual(before);
      }
    });
  }

  test('LINK-002 three Google identities remain independently usable on one account', async () => {
    await using s = await acceptanceApi.run({ seed: 111 });
    const owner = await login(s, 1, aliceIdentity);
    const identities = [
      aliceIdentity,
      { sub: 'work-google', email: 'work@example.test' },
      { sub: 'personal-google', email: null },
    ];
    for (const identity of identities.slice(1)) {
      expect((await login(s, 1, identity, owner)).accountId).toBe(
        owner.accountId
      );
    }
    for (const identity of identities)
      expect((await login(s, 2, identity)).accountId).toBe(owner.accountId);
  });

  for (const session of [
    'missing',
    'forged',
    'signed-out',
    'expired',
  ] as const) {
    test(`LINK-003 ${session} source session cannot authorize linking`, async () => {
      await using s = await acceptanceApi.run({ seed: 112 });
      const owner = await login(s, 1, aliceIdentity);
      if (session === 'signed-out')
        await call(s, {
          path: '/auth/sign-out',
          headers: headers(owner),
          body: {},
        });
      if (session === 'expired') await s.advanceTime(31 * 86_400_000);
      const auth =
        session === 'missing'
          ? {}
          : headers({
              ...owner,
              token: session === 'forged' ? 'forged' : owner.token,
            });
      const launch = await call(s, {
        path: `/auth/oauth/launch?provider=google&intent=link&callbackUrl=${encodeURIComponent(CALLBACK)}`,
        method: 'GET',
        headers: auth,
      });
      expect(launch.status).toBe(401);
      expect(launch.headers['location']).toBeUndefined();
    });
  }

  test('LINK-004 linking an existing account never silently merges or transfers data', async () => {
    await using s = await acceptanceApi.run({ seed: 113 });
    const a = await login(s, 1, aliceIdentity);
    const b = await login(s, 2, bobIdentity);
    await applied(s, a, 'claimUsername', { username: 'alice_kept' });
    await applied(s, b, 'claimUsername', { username: 'bob_kept' });
    const aBefore = await query(s, a, 'ownProfile');
    const bBefore = await query(s, b, 'ownProfile');
    // Contract: an already-owned provider identity offers explicit switching;
    // it must not turn a link callback into an implicit account switch.
    const launch = await call(s, {
      path: `/auth/oauth/launch?provider=google&intent=link&callbackUrl=${encodeURIComponent(CALLBACK)}`,
      method: 'GET',
      headers: headers(a),
    });
    expect(launch.status).toBe(302);
    const state = new URL(launch.headers['location']!).searchParams.get(
      'state'
    );
    const conflict = await call(s, {
      path: `/auth/callback/google?state=${state}&code=fixture-code`,
      method: 'GET',
    });
    expect(conflict.status).toBe(409);
    expect(await query(s, a, 'ownProfile')).toEqual(aBefore);
    expect(await query(s, b, 'ownProfile')).toEqual(bBefore);
    const switched = await login(s, 1, bobIdentity);
    expect(switched.accountId).toBe(b.accountId);
    expect(await query(s, switched, 'ownProfile')).toEqual(bBefore);
  });

  test('LINK-005 unlinking the last sign-in method is refused without locking the owner out', async () => {
    await using s = await acceptanceApi.run({ seed: 114 });
    const owner = await login(s, 1, aliceIdentity);
    const result = await call(s, {
      path: '/auth/accounts/unlink',
      headers: headers(owner),
      body: { provider: 'google', subject: aliceIdentity.sub },
    });
    expect(result.status).toBe(409);
    expect((await login(s, 2, aliceIdentity)).accountId).toBe(owner.accountId);
  });

  for (const removed of ['alice-google', 'second-google']) {
    test(`LINK-006 unlink ${removed}: remaining method retains data; removed method loses access`, async () => {
      await using s = await acceptanceApi.run({ seed: 115 });
      const owner = await login(s, 1, aliceIdentity);
      const second = { sub: 'second-google', email: null };
      expect((await login(s, 1, second, owner)).accountId).toBe(
        owner.accountId
      );
      await applied(s, owner, 'claimUsername', { username: 'survives_unlink' });
      const before = await query(s, owner, 'ownProfile');
      const result = await call(s, {
        path: '/auth/accounts/unlink',
        headers: headers(owner),
        body: { provider: 'google', subject: removed },
      });
      expect(result.status).toBe(200);
      const remaining = removed === aliceIdentity.sub ? second : aliceIdentity;
      const retained = await login(s, 2, remaining);
      expect(retained.accountId).toBe(owner.accountId);
      expect(await query(s, retained, 'ownProfile')).toEqual(before);
      const detached = await login(
        s,
        3,
        removed === aliceIdentity.sub ? aliceIdentity : second
      );
      expect(detached.accountId).not.toBe(owner.accountId);
    });
  }

  test('LINK-007 unlinking another account subject changes neither account', async () => {
    await using s = await acceptanceApi.run({ seed: 116 });
    const owner = await login(s, 1, aliceIdentity);
    const other = await login(s, 2, bobIdentity);
    const last = await call(s, {
      path: '/auth/accounts/unlink',
      headers: headers(owner),
      body: { provider: 'google', subject: aliceIdentity.sub },
    });
    expect(last.status).toBe(409);
    const cross = await call(s, {
      path: '/auth/accounts/unlink',
      headers: headers(owner),
      body: { provider: 'google', subject: bobIdentity.sub },
    });
    expect(cross.status).toBe(404);
    expect((await login(s, 3, aliceIdentity)).accountId).toBe(owner.accountId);
    expect((await login(s, 4, bobIdentity)).accountId).toBe(other.accountId);
  });
});
