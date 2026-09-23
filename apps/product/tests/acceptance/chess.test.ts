import { describe, expect, test } from 'bun:test';
import type { AcceptanceApi } from '@apps/product/sim/acceptance/system';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';
import { defineAction } from '@pkgs/sim';

import {
  aliceIdentity,
  applied,
  bobIdentity,
  live,
  login,
  mutate,
  query,
} from './support';

const seedPuzzles = defineAction({
  name: 'acceptance.seedPuzzles',
  async act(s: AcceptanceApi) {
    const { seedSimChessPuzzles } = await import(
      '@apps/product/sim/setup/seed-sim-chess-puzzles'
    );
    await seedSimChessPuzzles({
      sqlClient: await s.sim.server.openSqlClient(),
    });
  },
});

describe('Chess / own puzzle activity', () => {
  test('CHESS-001 the shared catalog is readable and activity stays on the owner', async () => {
    await using s = await acceptanceApi.run({ seed: 601 });
    const owner = await login(s, 1, aliceIdentity);
    const stranger = await login(s, 2, bobIdentity);
    await s.apply(seedPuzzles);
    const pool = (
      await query(s, owner, 'chessPuzzlePool', {
        ratingMin: 0,
        ratingMax: 4000,
      })
    )['chess_puzzles']!;
    expect(pool.length).toBeGreaterThan(0);
    const puzzleId = String(pool[0]!['id']);
    await applied(s, owner, 'upsertPuzzleProfile', {
      ownerId: owner.accountId,
      rating: 1200,
      ratingDeviation: 200,
    });
    expect(
      (
        await mutate(s, stranger, 'upsertPuzzleProfile', {
          ownerId: owner.accountId,
          rating: 2500,
          ratingDeviation: 50,
        })
      ).status
    ).toBe('rejected');
    expect(
      (
        await mutate(s, stranger, 'appendPuzzleInteraction', {
          interactionId: 'stolen',
          ownerId: owner.accountId,
          puzzleId,
          puzzleRating: 1200,
          kind: 'solved',
          solveIdx: 0,
          correct: true,
        })
      ).status
    ).toBe('rejected');
    await applied(s, owner, 'appendPuzzleInteraction', {
      interactionId: 'played',
      ownerId: owner.accountId,
      puzzleId,
      puzzleRating: 1200,
      kind: 'solved',
      solveIdx: 0,
      correct: true,
    });
    await applied(s, owner, 'appendPuzzleInteraction', {
      interactionId: 'played',
      ownerId: owner.accountId,
      puzzleId,
      puzzleRating: 1200,
      kind: 'solved',
      solveIdx: 0,
      correct: true,
    });
    const mine = live(
      (await query(s, owner, 'chessPuzzleInteractions'))[
        'chess_puzzle_interactions'
      ]!
    );
    expect(mine).toHaveLength(1);
    expect(mine[0]!['puzzle_id']).toBe(puzzleId);
    expect(
      (await query(s, stranger, 'chessPuzzleInteractions'))[
        'chess_puzzle_interactions'
      ]
    ).toEqual([]);
    expect(
      (await query(s, stranger, 'chessPuzzleProfile'))['chess_puzzle_profiles']
    ).toEqual([]);
    expect(
      (await query(s, owner, 'chessPuzzleProfile'))[
        'chess_puzzle_profiles'
      ]![0]!['rating']
    ).toBe(1200);
  });

  test('CHESS-002 puzzle profile survives an account switch and does not leak', async () => {
    await using s = await acceptanceApi.run({ seed: 602 });
    const owner = await login(s, 1, aliceIdentity);
    await applied(s, owner, 'upsertPuzzleProfile', {
      ownerId: owner.accountId,
      rating: 1400,
      ratingDeviation: 80,
    });
    const before = await query(s, owner, 'chessPuzzleProfile');
    const other = await login(s, 1, bobIdentity);
    await applied(s, other, 'upsertPuzzleProfile', {
      ownerId: other.accountId,
      rating: 800,
      ratingDeviation: 300,
    });
    expect(
      (await query(s, other, 'chessPuzzleProfile'))[
        'chess_puzzle_profiles'
      ]![0]!['owner_id']
    ).toBe(other.accountId);
    const again = await login(s, 1, aliceIdentity);
    expect(await query(s, again, 'chessPuzzleProfile')).toEqual(before);
  });

  test('CHESS-003 an unknown interaction kind is rejected without a row', async () => {
    await using s = await acceptanceApi.run({ seed: 603 });
    const owner = await login(s, 1, aliceIdentity);
    expect(
      (
        await mutate(s, owner, 'appendPuzzleInteraction', {
          interactionId: 'bad',
          ownerId: owner.accountId,
          puzzleId: 'puzzle',
          puzzleRating: 1000,
          kind: 'cheated',
          solveIdx: 0,
        })
      ).status
    ).toBe('rejected');
    expect(
      (await query(s, owner, 'chessPuzzleInteractions'))[
        'chess_puzzle_interactions'
      ]
    ).toEqual([]);
  });
});
