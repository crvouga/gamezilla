import { describe, expect, test } from 'bun:test';

import {
  buildPuzzleCandidatesSql,
  buildPuzzleMatchedCountSql,
  pickPuzzleIdFromPool,
} from './next-puzzle-id-helpers';

describe('buildPuzzleCandidatesSql', () => {
  test('rating band bounds are present in SQL', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: '',
      historyFilter: 'any',
      themes: [],
      currentPuzzleId: null,
    });
    expect(query.sql).toContain('rating >= ?');
    expect(query.sql).toContain('rating <= ?');
    expect(query.values).toEqual([1300, 1700, 50, 0]);
  });

  test('neverSeen excludes interacted puzzles via subquery', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: 'user_123',
      historyFilter: 'neverSeen',
      themes: [],
      currentPuzzleId: null,
    });
    const normalized = query.sql.replace(/\s+/g, ' ');
    expect(normalized).toContain(
      'NOT IN ( SELECT puzzle_id FROM chess_puzzle_interactions'
    );
    expect(query.values).toContain('user_123');
  });

  test('seen requires prior interaction', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: null,
      ownerId: 'user_123',
      historyFilter: 'seen',
      themes: [],
      currentPuzzleId: null,
    });
    const normalized = query.sql.replace(/\s+/g, ' ');
    expect(normalized).toContain(
      'id IN ( SELECT puzzle_id FROM chess_puzzle_interactions'
    );
    expect(normalized).not.toContain('NOT IN');
  });

  test('failed excludes solved puzzles', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: null,
      ownerId: 'user_123',
      historyFilter: 'failed',
      themes: [],
      currentPuzzleId: null,
    });
    const normalized = query.sql.replace(/\s+/g, ' ');
    expect(normalized).toContain('kind = ?');
    expect(query.values).toContain('solved');
  });

  test('themes add json_each OR filter', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: null,
      ownerId: '',
      historyFilter: 'any',
      themes: ['fork', 'mate'],
      currentPuzzleId: null,
    });
    const normalized = query.sql.replace(/\s+/g, ' ');
    expect(normalized).toContain('json_each(themes)');
    expect(normalized).toContain('theme_row.value IN');
    expect(query.values).toEqual(
      expect.arrayContaining(['fork', 'mate', 50, 0])
    );
  });

  test('currentPuzzleId adds inequality filter', () => {
    const query = buildPuzzleCandidatesSql({
      rating: 1500,
      halfWindow: 200,
      ownerId: 'user_123',
      historyFilter: 'neverSeen',
      themes: [],
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
      historyFilter: 'any',
      themes: [],
      currentPuzzleId: null,
      pickOffset: 28,
    });
    expect(query.sql).not.toContain('rating >=');
    expect(query.sql).not.toContain('rating <=');
    expect(query.values).toEqual([50, 28]);
  });
});

describe('buildPuzzleMatchedCountSql', () => {
  test('counts with theme filter and no limit', () => {
    const query = buildPuzzleMatchedCountSql({
      rating: 1200,
      halfWindow: 400,
      ownerId: 'u1',
      historyFilter: 'neverSeen',
      themes: ['fork'],
      currentPuzzleId: null,
    });
    expect(query.sql).toContain('COUNT(*)');
    expect(query.sql).not.toContain('LIMIT');
    expect(query.values).toContain('fork');
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
