import { describe, expect, test } from 'bun:test';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';
import {
  aliceIdentity,
  applied,
  bobIdentity,
  login,
  mutate,
  query,
} from './support';

describe('Profile / durable identity', () => {
  for (const username of [
    '',
    'a',
    'a'.repeat(100),
    'a b',
    '<script>',
    'user/name',
    '🎮🎮🎮',
  ]) {
    test(`PROFILE-001 rejects invalid username ${JSON.stringify(username)} without changing profile`, async () => {
      await using s = await acceptanceApi.run({ seed: 401 });
      const a = await login(s, 1, aliceIdentity);
      await applied(s, a, 'ensureProfile', {});
      const before = await query(s, a, 'ownProfile');
      expect((await mutate(s, a, 'claimUsername', { username })).status).toBe(
        'rejected'
      );
      expect(await query(s, a, 'ownProfile')).toEqual(before);
    });
  }

  test('PROFILE-002 username uniqueness ignores case across different accounts', async () => {
    await using s = await acceptanceApi.run({ seed: 402 });
    const a = await login(s, 1, aliceIdentity);
    const b = await login(s, 2, bobIdentity);
    await applied(s, a, 'claimUsername', { username: 'ExampleUser' });
    expect(
      (await mutate(s, b, 'claimUsername', { username: 'exampleuser' })).status
    ).toBe('rejected');
    expect((await query(s, a, 'ownProfile'))['profile']![0]!['username']).toBe(
      'exampleuser'
    );
  });

  test('PROFILE-003 profile survives account switching without leaking', async () => {
    await using s = await acceptanceApi.run({ seed: 403 });
    const a = await login(s, 1, aliceIdentity);
    await applied(s, a, 'claimUsername', { username: 'alice_saved' });
    const before = await query(s, a, 'ownProfile');
    const b = await login(s, 1, bobIdentity);
    await applied(s, b, 'claimUsername', { username: 'bob_saved' });
    expect((await query(s, b, 'ownProfile'))['profile']![0]!['id']).toBe(
      b.accountId
    );
    const again = await login(s, 1, aliceIdentity);
    expect(await query(s, again, 'ownProfile')).toEqual(before);
  });

  for (const avatarConfig of ['not-json', 42, null, []]) {
    test(`PROFILE-004 invalid avatar ${JSON.stringify(avatarConfig)} is rejected atomically`, async () => {
      await using s = await acceptanceApi.run({ seed: 404 });
      const a = await login(s, 1, aliceIdentity);
      await applied(s, a, 'ensureProfile', {});
      const before = await query(s, a, 'ownProfile');
      expect((await mutate(s, a, 'patchAvatar', { avatarConfig })).status).toBe(
        'rejected'
      );
      expect(await query(s, a, 'ownProfile')).toEqual(before);
    });
  }
});
