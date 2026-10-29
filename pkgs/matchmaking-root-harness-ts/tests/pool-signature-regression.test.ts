import { expect, test } from 'bun:test';
import { join, tick } from '@pkgs/matchmaking-root-harness-ts/actions';
import {
  ModeAttr,
  NameAttr,
  RatingAttr,
  RegionAttr,
  ratingWithin,
} from '@pkgs/matchmaking-root-harness-ts/attrs';
import { statusOf } from '@pkgs/matchmaking-root-harness-ts/observations';
import { matchmaking } from '@pkgs/matchmaking-root-harness-ts/system';
import type { StatusResult } from '@pkgs/matchmaking-root-shared-ts/types';

// regression: matchmaking-pool-signature-collision
// Pools are the (region, mode) pairs ('a\u001fb', '') and ('a', 'b\u001f'):
// joined with the unit separator both read 'a\u001fb\u001f', so two
// different pools were treated as one and their people were paired.
test('pools whose values contain the old separator stay distinct', async () => {
  await using s = await matchmaking.run({
    seed: 'pool-signature-collision',
    args: {
      replicas: 1,
      schema: { partitionKeys: [RegionAttr.key, ModeAttr.key] },
    },
  });
  const people = [
    { person: 'alice', region: 'a\u001fb', mode: '' },
    { person: 'bob', region: 'a', mode: 'b\u001f' },
  ];
  for (const { person, region, mode } of people) {
    await s.apply(join, {
      ref: person,
      input: {
        data: {
          ...NameAttr(person),
          ...RatingAttr(1000),
          ...RegionAttr(region),
          ...ModeAttr(mode),
        },
        formulas: [ratingWithin(200)],
      },
    });
  }
  await s.apply(tick, {});
  expect(
    ((await s.read(statusOf, 'alice')) as StatusResult | null)?.status
  ).toBe('waiting');
  expect(((await s.read(statusOf, 'bob')) as StatusResult | null)?.status).toBe(
    'waiting'
  );
});
