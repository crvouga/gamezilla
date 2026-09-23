import { describe, expect, test } from 'bun:test';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';
import {
  type Actor,
  type ApiRun,
  aliceIdentity,
  applied,
  bobIdentity,
  live,
  login,
  mutate,
  query,
} from './support';

type Who = 'sender' | 'recipient' | 'stranger';

function decisionOwner(decision: string): Who {
  if (decision === 'cancelFriendRequest') return 'sender';
  return 'recipient';
}

function requestStatus(decision: string, allowed: boolean): string {
  if (!allowed) return 'pending';
  if (decision === 'acceptFriendRequest') return 'accepted';
  if (decision === 'declineFriendRequest') return 'declined';
  return 'cancelled';
}

async function runDecision(decision: string, who: Who) {
  await using s = await acceptanceApi.run({ seed: 201 });
  const sender = await login(s, 1, aliceIdentity);
  const recipient = await login(s, 2, bobIdentity);
  const stranger = await login(s, 3, { sub: 'carol', email: null });
  await applied(s, sender, 'sendFriendRequest', {
    requestId: 'request-1',
    toUserId: recipient.accountId,
  });
  const allowed = who === decisionOwner(decision);
  const verdict = await mutate(
    s,
    { sender, recipient, stranger }[who],
    decision,
    {
      requestId: 'request-1',
    }
  );
  expect(verdict.status).toBe(allowed ? 'applied' : 'rejected');
  const rows = (await query(s, recipient, 'friendRequests'))[
    'friends_requests'
  ]!;
  expect(rows.find((row) => row['id'] === 'request-1')?.['status']).toBe(
    requestStatus(decision, allowed)
  );
  expect(
    (await query(s, stranger, 'friendRequests'))['friends_requests']
  ).toEqual([]);
  const expectedFriends = allowed && decision === 'acceptFriendRequest' ? 1 : 0;
  await expectFriendCount(s, sender, expectedFriends);
  await expectFriendCount(s, recipient, expectedFriends);
}

async function expectFriendCount(s: ApiRun, actor: Actor, count: number) {
  expect(
    live((await query(s, actor, 'friendships'))['friends_friendships']!)
  ).toHaveLength(count);
}

describe('Friends / authorization and lifecycle', () => {
  for (const decision of [
    'acceptFriendRequest',
    'declineFriendRequest',
    'cancelFriendRequest',
  ]) {
    for (const who of ['sender', 'recipient', 'stranger'] as const) {
      test(`FRIENDS-001 ${who} attempts ${decision}`, async () => {
        await runDecision(decision, who);
      });
    }
  }

  for (const stage of ['none', 'pending', 'accepted'] as const) {
    for (const blocker of ['sender', 'recipient'] as const) {
      test(`FRIENDS-002 block by ${blocker} at ${stage}; unblock never silently restores friendship`, async () => {
        await using s = await acceptanceApi.run({ seed: 202 });
        const sender = await login(s, 1, aliceIdentity);
        const recipient = await login(s, 2, bobIdentity);
        if (stage !== 'none')
          await applied(s, sender, 'sendFriendRequest', {
            requestId: 'r',
            toUserId: recipient.accountId,
          });
        if (stage === 'accepted')
          await applied(s, recipient, 'acceptFriendRequest', {
            requestId: 'r',
          });
        const actor = blocker === 'sender' ? sender : recipient;
        const other = blocker === 'sender' ? recipient : sender;
        await applied(s, actor, 'blockUser', {
          userId: other.accountId,
          blockId: 'block',
        });
        for (const [from, to] of [
          [actor, other],
          [other, actor],
        ] as const) {
          expect(
            (
              await mutate(s, from, 'sendFriendRequest', {
                requestId: `blocked-${from.deviceId}`,
                toUserId: to.accountId,
              })
            ).status
          ).toBe('rejected');
          expect(
            live((await query(s, from, 'friendships'))['friends_friendships']!)
          ).toHaveLength(0);
        }
        await applied(s, actor, 'unblockUser', { userId: other.accountId });
        expect(
          live((await query(s, actor, 'userBlocks'))['friends_blocks']!)
        ).toHaveLength(0);
        expect(
          live((await query(s, actor, 'friendships'))['friends_friendships']!)
        ).toHaveLength(0);
        await applied(s, sender, 'sendFriendRequest', {
          requestId: 'new-request',
          toUserId: recipient.accountId,
        });
        expect(
          (await query(s, recipient, 'friendRequests'))[
            'friends_requests'
          ]!.filter((row) => row['status'] === 'pending')
        ).toHaveLength(1);
      });
    }
  }

  test('FRIENDS-003 repeated and crossed requests cannot create duplicate relationships', async () => {
    await using s = await acceptanceApi.run({ seed: 203 });
    const a = await login(s, 1, aliceIdentity);
    const b = await login(s, 2, bobIdentity);
    for (const requestId of ['r1', 'r2'])
      await applied(s, a, 'sendFriendRequest', {
        requestId,
        toUserId: b.accountId,
      });
    expect(
      (
        await mutate(s, b, 'sendFriendRequest', {
          requestId: 'cross',
          toUserId: a.accountId,
        })
      ).status
    ).toBe('rejected');
    for (let i = 0; i < 2; i++)
      await applied(s, b, 'acceptFriendRequest', { requestId: 'r1' });
    expect(
      live((await query(s, a, 'friendships'))['friends_friendships']!)
    ).toHaveLength(1);
    await applied(s, a, 'removeFriend', { userId: b.accountId });
    const tombstones = (await query(s, b, 'friendships'))[
      'friends_friendships'
    ]!;
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0]!['deleted_at']).not.toBeNull();
  });

  for (const name of ['sendFriendRequest', 'blockUser', 'removeFriend']) {
    test(`FRIENDS-004 self ${name} is rejected without rows`, async () => {
      await using s = await acceptanceApi.run({ seed: 204 });
      const a = await login(s, 1, aliceIdentity);
      expect(
        (
          await mutate(s, a, name, {
            toUserId: a.accountId,
            userId: a.accountId,
            requestId: 'self',
            blockId: 'self',
          })
        ).status
      ).toBe('rejected');
      expect((await query(s, a, 'friendRequests'))['friends_requests']).toEqual(
        []
      );
      expect((await query(s, a, 'userBlocks'))['friends_blocks']).toEqual([]);
    });
  }
});
