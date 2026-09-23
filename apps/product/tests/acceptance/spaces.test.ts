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

type Relation = 'stranger' | 'friend' | 'invited';

function joinAllowed(
  visibility: string,
  relation: Relation,
  ended: boolean
): boolean {
  if (ended) return false;
  if (visibility === 'public') return true;
  return relation !== 'stranger';
}

async function runJoin(visibility: string, relation: Relation, ended: boolean) {
  await using s = await acceptanceApi.run({ seed: 301 });
  const host = await login(s, 1, aliceIdentity);
  const guest = await login(s, 2, bobIdentity);
  await applied(s, host, 'createSpace', { spaceId: 'space', visibility });
  if (relation === 'friend') {
    await applied(s, host, 'sendFriendRequest', {
      requestId: 'r',
      toUserId: guest.accountId,
    });
    await applied(s, guest, 'acceptFriendRequest', { requestId: 'r' });
  }
  if (relation === 'invited') {
    await applied(s, host, 'addSpaceUser', {
      spaceId: 'space',
      userId: guest.accountId,
    });
  }
  if (ended) await applied(s, host, 'endSpace', { spaceId: 'space' });
  const allowed = joinAllowed(visibility, relation, ended);
  expect(
    (await mutate(s, guest, 'joinSpace', { spaceId: 'space' })).status
  ).toBe(allowed ? 'applied' : 'rejected');
  const sessions = (await query(s, guest, 'openSpaceSessions'))[
    'spaces_open_sessions'
  ]!;
  const open = sessions.filter(
    (row) => row['space_id'] === 'space' && row['deleted_at'] === null
  );
  expect(open).toHaveLength(allowed ? 1 : 0);
}

describe('Spaces / access matrix', () => {
  for (const visibility of ['public', 'private']) {
    for (const relation of ['stranger', 'friend', 'invited'] as const) {
      for (const ended of [false, true]) {
        test(`SPACES-001 ${visibility}, ${relation}, ended=${ended}`, async () => {
          await runJoin(visibility, relation, ended);
        });
      }
    }
  }

  for (const operation of [
    'renameSpace',
    'setVisibility',
    'endSpace',
    'addSpaceUser',
    'removeSpaceUser',
    'createSpace',
  ]) {
    test(`SPACES-002 another account cannot take over via ${operation}`, async () => {
      await using s = await acceptanceApi.run({ seed: 302 });
      const host = await login(s, 1, aliceIdentity);
      const attacker = await login(s, 2, bobIdentity);
      await applied(s, host, 'createSpace', {
        spaceId: 'space',
        visibility: 'private',
      });
      const before = (await query(s, host, 'mySpaces'))['spaces'];
      const result = await mutate(s, attacker, operation, {
        spaceId: 'space',
        title: 'stolen',
        visibility: 'public',
        userId: host.accountId,
      });
      expect(result.status).toBe('rejected');
      expect((await query(s, host, 'mySpaces'))['spaces']).toEqual(before);
    });
  }

  test('SPACES-003 leave/rejoin then host end closes participants on every device', async () => {
    await using s = await acceptanceApi.run({ seed: 303 });
    const host = await login(s, 1, aliceIdentity);
    const guest = await login(s, 2, bobIdentity);
    await applied(s, host, 'createSpace', {
      spaceId: 'space',
      visibility: 'public',
    });
    await applied(s, host, 'renameSpace', {
      spaceId: 'space',
      title: 'Friday games',
    });
    expect((await query(s, host, 'mySpaces'))['spaces']![0]!['title']).toBe(
      'Friday games'
    );
    for (let i = 0; i < 2; i++) {
      await applied(s, guest, 'joinSpace', { spaceId: 'space' });
      await applied(s, guest, 'leaveSpace', { spaceId: 'space' });
    }
    await applied(s, guest, 'joinSpace', { spaceId: 'space' });
    await applied(s, host, 'endSpace', { spaceId: 'space' });
    expect(
      (await mutate(s, guest, 'joinSpace', { spaceId: 'space' })).status
    ).toBe('rejected');
    expect(
      (await query(s, host, 'mySpaces'))['spaces']![0]!['ended_at']
    ).not.toBeNull();
  });
});
