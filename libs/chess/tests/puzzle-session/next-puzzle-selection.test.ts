import { describe, expect, test } from 'bun:test';

import {
  buildPuzzleCandidatesSql,
  buildPuzzleMatchedCountSql,
  capPuzzleCandidateOffset,
  computeNextPuzzleLoading,
  DEFAULT_PUZZLE_RATING,
  PUZZLE_CANDIDATE_MAX_OFFSET,
  pickPuzzleIdFromPool,
  resolveProfilePuzzleRating,
  resolvePuzzlePickOffset,
  selectPuzzleCandidates,
} from '@libs/chess/public/puzzle-session';

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

describe('capPuzzleCandidateOffset', () => {
  test('clamps past end of small catalog', () => {
    expect(capPuzzleCandidateOffset(71, 50)).toBe(0);
    expect(capPuzzleCandidateOffset(10, 50)).toBe(0);
  });

  test('preserves offset when catalog is large enough', () => {
    expect(capPuzzleCandidateOffset(71, 5000)).toBe(71);
    expect(capPuzzleCandidateOffset(0, 5000)).toBe(0);
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

describe('selectPuzzleCandidates', () => {
  const banded = { rows: [{ id: 'b', rating: 1500 }], isLoading: false };
  const fallback = { rows: [{ id: 'f', rating: 1900 }], isLoading: false };

  test('prefers the banded page while it has rows', () => {
    expect(selectPuzzleCandidates(banded, fallback)).toBe(banded);
  });

  test('falls back to the unbounded page when the band is empty', () => {
    expect(
      selectPuzzleCandidates({ rows: [], isLoading: false }, fallback)
    ).toBe(fallback);
  });
});

describe('computeNextPuzzleLoading', () => {
  const ready = { rows: [{ id: 'b', rating: 1500 }], isLoading: false };
  const empty = { rows: [], isLoading: false };
  const pending = { rows: [], isLoading: true };
  const base = {
    myId: 'user_1',
    banded: ready,
    fallback: ready,
    puzzleId: 'b',
    localPuzzleTotal: 500,
  };

  test('settled once a candidate is picked', () => {
    expect(computeNextPuzzleLoading(base)).toBe(false);
  });

  test('loading without identity or while the banded page is pending', () => {
    expect(computeNextPuzzleLoading({ ...base, myId: '' })).toBe(true);
    expect(computeNextPuzzleLoading({ ...base, banded: pending })).toBe(true);
  });

  test('empty band waits for the fallback page only', () => {
    expect(
      computeNextPuzzleLoading({ ...base, banded: empty, fallback: pending })
    ).toBe(true);
    expect(
      computeNextPuzzleLoading({ ...base, banded: empty, fallback: ready })
    ).toBe(false);
  });

  test('no candidates and an empty local catalog keeps waiting for sync', () => {
    expect(
      computeNextPuzzleLoading({
        ...base,
        banded: empty,
        fallback: empty,
        puzzleId: null,
        localPuzzleTotal: 0,
      })
    ).toBe(true);
    expect(
      computeNextPuzzleLoading({
        ...base,
        banded: empty,
        fallback: empty,
        puzzleId: null,
        localPuzzleTotal: 12,
      })
    ).toBe(false);
  });
});

describe('resolvePuzzlePickOffset', () => {
  test('deterministic for a seed and bounded by the rotation window', () => {
    const a = resolvePuzzlePickOffset('sess-1', 10_000);
    expect(a).toBe(resolvePuzzlePickOffset('sess-1', 10_000));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(PUZZLE_CANDIDATE_MAX_OFFSET);
  });

  test('clamps to zero for tiny catalogs', () => {
    expect(resolvePuzzlePickOffset('sess-1', 50)).toBe(0);
  });
});

describe('resolveProfilePuzzleRating', () => {
  test('uses a positive recorded rating, else the default seed', () => {
    expect(resolveProfilePuzzleRating(1732)).toBe(1732);
    expect(resolveProfilePuzzleRating(0)).toBe(DEFAULT_PUZZLE_RATING);
    expect(resolveProfilePuzzleRating(undefined)).toBe(DEFAULT_PUZZLE_RATING);
    expect(resolveProfilePuzzleRating('1500')).toBe(DEFAULT_PUZZLE_RATING);
  });
});
