import { describe, expect, test } from 'bun:test';

import {
  buildPuzzleCandidatesSql,
  pickPuzzleIdFromPool,
} from './next-puzzle-id-helpers';

describe('buildPuzzleCandidatesSql', () => {
  test('rating band bounds are present in SQL', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: '',
      currentPuzzleId: null,
    });
    expect(query.sql).toContain('rating >= ?');
    expect(query.sql).toContain('rating <= ?');
    expect(query.values).toEqual([1300, 1700, 50, 0]);
  });

  test('with ownerId, excludes interacted puzzles via subquery', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: 'user_123',
      currentPuzzleId: null,
    });
    const normalized = query.sql.replace(/\s+/g, ' ');
    expect(normalized).toContain(
      'NOT IN ( SELECT puzzle_id FROM chess_puzzle_interactions'
    );
    expect(query.values).toContain('user_123');
  });

  test('currentPuzzleId adds inequality filter', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: 'user_123',
      currentPuzzleId: 'puzzle_99',
    });
    expect(query.sql).toContain('id != ?');
    expect(query.values).toContain('puzzle_99');
  });

  test('halfWindow null omits rating bounds (unbounded fallback)', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 3000,
      halfWindow: null,
      ownerId: '',
      currentPuzzleId: null,
      pickOffset: 28,
    });
    expect(query.sql).not.toContain('rating >=');
    expect(query.sql).not.toContain('rating <=');
    expect(query.values).toEqual([50, 28]);
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
