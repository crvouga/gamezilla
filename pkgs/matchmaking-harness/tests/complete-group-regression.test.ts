import { expect, test } from 'bun:test';
import { join, tick } from '@pkgs/matchmaking-harness/actions';
import {
  NameAttr,
  RatingAttr,
  ratingWithin,
} from '@pkgs/matchmaking-harness/attrs';
import { statusOf } from '@pkgs/matchmaking-harness/observations';
import { matchmaking } from '@pkgs/matchmaking-harness/system';
import type { StatusResult } from '@pkgs/matchmaking-shared/types';

// regression: matchmaking-incomplete-greedy-group
// Bob can accept Alice, Carol and Dave. Alice accepts only Bob: taking
// Alice first must not hide the complete Bob/Carol/Dave group.
test('an earlier incompatible choice cannot hide a complete group', async () => {
  await using s = await matchmaking.run({
    seed: 'complete-group',
    args: { replicas: 3 },
  });
  const people = [
    { person: 'bob', rating: 1050, range: 200 },
    { person: 'alice', rating: 1000, range: 50 },
    { person: 'carol', rating: 1100, range: 200 },
    { person: 'dave', rating: 1150, range: 200 },
  ];
  for (const person of people) {
    await s.apply(join, {
      ref: person.person,
      input: {
        data: { ...NameAttr(person.person), ...RatingAttr(person.rating) },
        formulas: [ratingWithin(person.range)],
        groupSize: 3,
      },
    });
    await s.advanceTime(1);
  }
  await s.apply(tick, { replicaId: 'r2' });
  const bob = (await s.read(statusOf, 'bob')) as StatusResult | null;
  const carol = (await s.read(statusOf, 'carol')) as StatusResult | null;
  const dave = (await s.read(statusOf, 'dave')) as StatusResult | null;
  expect(bob?.status).toBe('matched');
  expect(carol?.status).toBe('matched');
  expect(dave?.status).toBe('matched');
  if (
    bob?.status !== 'matched' ||
    carol?.status !== 'matched' ||
    dave?.status !== 'matched'
  )
    return;
  expect(new Set([bob.matchId, carol.matchId, dave.matchId]).size).toBe(1);
  expect(bob.peers).toHaveLength(2);
  expect(
    ((await s.read(statusOf, 'alice')) as StatusResult | null)?.status
  ).toBe('waiting');
});

// regression: matchmaking-formula-radius-pruned
// Both people accept a distance of 199 despite the host's default radius
// of 50. A storage bucket is not an additional acceptance rule.
test('a per-person range is not pruned by the host default radius', async () => {
  await using s = await matchmaking.run({
    seed: 'formula-radius',
    args: { replicas: 3, schema: { primaryNumericKey: RatingAttr.key } },
  });
  for (const person of [
    { name: 'alice', rating: 1000 },
    { name: 'bob', rating: 1199 },
  ]) {
    await s.apply(join, {
      ref: person.name,
      input: {
        data: { ...NameAttr(person.name), ...RatingAttr(person.rating) },
        formulas: [ratingWithin(200)],
      },
    });
  }
  await s.apply(tick, { replicaId: 'r1' });
  expect(
    ((await s.read(statusOf, 'alice')) as StatusResult | null)?.status
  ).toBe('matched');
  expect(((await s.read(statusOf, 'bob')) as StatusResult | null)?.status).toBe(
    'matched'
  );
});
