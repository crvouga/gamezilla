import { expect, test } from 'bun:test';
import type { StatusResult } from '@pkgs/matchmaking/interface';
import {
  join,
  leave,
  matchmaking,
  NameAttr,
  participantIds,
  RatingAttr,
  ratingWithin,
  statusOf,
} from '@pkgs/matchmaking-harness';

function request(requestId: string, rating: number) {
  return {
    ownerId: 'alice',
    requestId,
    data: { ...NameAttr('alice'), ...RatingAttr(rating) },
    formulas: [ratingWithin(50)],
  };
}

// regression: matchmaking-port-duplicate-owner
test('two devices begin through the public port and retain one owned wait', async () => {
  await using s = await matchmaking.run({
    seed: 'owned-devices',
    args: { replicas: 3 },
  });
  await s.apply(join, {
    ref: 'phone',
    replicaId: 'r0',
    input: request('phone-1', 1000),
  });
  await s.apply(join, {
    ref: 'computer',
    replicaId: 'r2',
    input: request('computer-1', 1500),
  });
  const ids = await s.read(participantIds);
  expect(ids['computer']).toBe(ids['phone']);
  expect(
    ((await s.read(statusOf, 'computer')) as StatusResult | null)?.data
  ).toEqual({
    ...NameAttr('alice'),
    ...RatingAttr(1000),
  });
});

// regression: matchmaking-replayed-begin-revives-wait
test('an earlier begin replay keeps its stopped identity after a newer begin', async () => {
  await using s = await matchmaking.run({
    seed: 'owned-retry',
    args: { replicas: 3 },
  });
  await s.apply(join, {
    ref: 'earlier',
    replicaId: 'r0',
    input: request('begin-1', 1000),
  });
  await s.apply(leave, { ref: 'earlier', replicaId: 'r1' });
  await s.apply(join, {
    ref: 'newer',
    replicaId: 'r2',
    input: request('begin-2', 1500),
  });
  await s.apply(join, {
    ref: 'replayed',
    replicaId: 'r1',
    input: request('begin-1', 1000),
  });
  const ids = await s.read(participantIds);
  expect(ids['replayed']).toBe(ids['earlier']);
  expect(await s.read(statusOf, 'replayed')).toBeNull();
  expect(
    ((await s.read(statusOf, 'newer')) as StatusResult | null)?.status
  ).toBe('waiting');
});
