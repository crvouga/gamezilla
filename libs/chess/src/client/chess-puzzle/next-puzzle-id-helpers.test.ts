import { describe, expect, test } from 'bun:test';

import {
  buildPuzzleCandidatesSql,
  pickPuzzleIdFromPool,
} from './next-puzzle-id-helpers';

describe('buildPuzzleCandidatesSql', () => {
  test('rating band bounds are present in SQL', () => {
    const { sql, params } = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: '',
      currentPuzzleId: null,
    });
    expect(sql).toContain('rating >= ?');
    expect(sql).toContain('rating <= ?');
    expect(params).toEqual([1300, 1700, 50, 0]);
  });

  test('with ownerId, excludes interacted puzzles via subquery', () => {
    const { sql, params } = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: 'user_123',
      currentPuzzleId: null,
    });
    expect(sql).toContain(
      'NOT IN (SELECT puzzle_id FROM chess_puzzle_interactions'
    );
    expect(params).toContain('user_123');
  });

  test('currentPuzzleId adds inequality filter', () => {
    const { sql, params } = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: 'user_123',
      currentPuzzleId: 'puzzle_99',
    });
    expect(sql).toContain('id != ?');
    expect(params).toContain('puzzle_99');
  });
});

describe('pickPuzzleIdFromPool', () => {
  test('returns null on empty pool', () => {
    expect(
      pickPuzzleIdFromPool({
        rows: [],
        rating: 1500,
        preferredBand: 100,
        seed: 'anything',
      })
    ).toBe(null);
  });

  test('seeded selection is stable across runs', () => {
    const rows = [
      { id: 'p1', rating: 1500 },
      { id: 'p2', rating: 1500 },
      { id: 'p3', rating: 1500 },
      { id: 'p4', rating: 1500 },
    ];
    const a = pickPuzzleIdFromPool({
      rows,
      rating: 1500,
      preferredBand: 100,
      seed: 'sess-1',
    });
    const b = pickPuzzleIdFromPool({
      rows,
      rating: 1500,
      preferredBand: 100,
      seed: 'sess-1',
    });
    expect(a).toBe(b);
    expect(a).not.toBe(null);
  });
});
