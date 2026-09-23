import { describe, expect, test } from 'bun:test';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';

import {
  aliceIdentity,
  applied,
  bobIdentity,
  call,
  headers,
  type Json,
  login,
  query,
} from './support';

describe('Sync / protocol and isolation', () => {
  test('SYNC-001 an old protocol is rejected and does not drop the account', async () => {
    await using s = await acceptanceApi.run({ seed: 801 });
    const actor = await login(s, 1, aliceIdentity);
    await applied(s, actor, 'claimUsername', { username: 'still_here' });
    for (const protocol of ['2', null]) {
      const authHeaders = headers(actor);
      if (protocol === null) delete authHeaders['x-sync-protocol'];
      else authHeaders['x-sync-protocol'] = protocol;
      const rejected = await call(s, {
        path: '/query',
        headers: authHeaders,
        body: { queries: [{ name: 'ownProfile', params: {} }] },
      });
      expect(rejected.status).toBe(401);
      expect((rejected.body as Json)['reason']).toBe('upgrade_required');
    }
    expect(
      (await query(s, actor, 'ownProfile'))['profile']![0]!['username']
    ).toBe('still_here');
  });

  test('SYNC-002 profile, friends, and spaces queries never cross accounts', async () => {
    await using s = await acceptanceApi.run({ seed: 802 });
    const owner = await login(s, 1, aliceIdentity);
    const other = await login(s, 2, bobIdentity);
    await applied(s, owner, 'claimUsername', { username: 'owner_only' });
    await applied(s, owner, 'createSpace', {
      spaceId: 'owner-space',
      visibility: 'private',
    });
    await applied(s, owner, 'sendFriendRequest', {
      requestId: 'owner-request',
      toUserId: other.accountId,
    });
    expect(
      (await query(s, other, 'ownProfile'))['profile']![0]!['username']
    ).not.toBe('owner_only');
    const spaces = (await query(s, other, 'mySpaces'))['spaces'] ?? [];
    expect(spaces.filter((row) => row['id'] === 'owner-space')).toHaveLength(0);
    const requests = (await query(s, other, 'friendRequests'))[
      'friends_requests'
    ]!;
    expect(
      requests.filter((row) => row['id'] === 'owner-request')
    ).toHaveLength(1);
    expect(
      (
        await query(
          s,
          await login(s, 3, { sub: 'carol', email: null }),
          'friendRequests'
        )
      )['friends_requests']
    ).toEqual([]);
  });
});
