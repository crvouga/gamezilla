import { describe, expect, test } from 'bun:test';
import {
  buildExhaustedPuzzleCandidatesSql,
  buildPuzzleBandCountSql,
  buildPuzzleCandidatesSql,
  buildPuzzleMatchedCountSql,
  capPuzzleCandidateOffset,
  computeNextPuzzleLoading,
  DEFAULT_PUZZLE_RATING,
  PUZZLE_CANDIDATE_MAX_OFFSET,
  PUZZLE_MIN_PLAYS,
  PUZZLE_MIN_POPULARITY,
  PUZZLE_WINDOW_HALF_MAX,
  PUZZLE_WINDOW_HALF_MIN,
  pickNextPuzzle,
  pickPuzzleIdFromPool,
  puzzleSelectionHalfWindow,
  resolveProfilePuzzleRating,
  resolvePuzzlePickOffset,
  selectPuzzleCandidates,
} from '@libs/game-puzzle-shared-ts/next-puzzle-selection';
import {
  PUZZLE_RATING_DEFAULT_RD,
  PUZZLE_RATING_RD_MIN,
} from '@libs/game-puzzle-shared-ts/rating';

describe('buildPuzzleCandidatesSql', () => {
  test('rating band bounds are present in SQL', () => {
    const query = buildPuzzleCandidatesSql({
      namespace: '',
      rating: 1500,
      halfWindow: 200,
      ownerId: '',
      historyFilter: 'any',
      themes: [],
      currentPuzzleId: null,
    });
    expect(query.sql).toContain('rating >= ?');
    expect(query.sql).toContain('rating <= ?');
    // §9 quality bars come first, then the rating window, LIMIT and OFFSET.
    expect(query.values).toEqual([
      PUZZLE_MIN_POPULARITY,
      PUZZLE_MIN_PLAYS,
      1300,
      1700,
      50,
      0,
    ]);
  });

  test('neverSeen excludes interacted puzzles via subquery', () => {
    const query = buildPuzzleCandidatesSql({
      namespace: '',
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
      namespace: '',
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
      namespace: '',
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

  test('themes add a quoted-id OR filter over the synced array', () => {
    const query = buildPuzzleCandidatesSql({
      namespace: '',
      rating: 1500,
      halfWindow: null,
      ownerId: '',
      historyFilter: 'any',
      themes: ['fork', 'mate'],
      currentPuzzleId: null,
    });
    const normalized = query.sql.replace(/\s+/g, ' ');
    expect(normalized).toContain('instr(themes, ?) > 0 OR instr(themes, ?)');
    expect(query.values).toEqual(
      expect.arrayContaining(['"fork"', '"mate"', 50])
    );
  });

  test('currentPuzzleId adds inequality filter', () => {
    const query = buildPuzzleCandidatesSql({
      namespace: '',
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
      namespace: '',
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
    // Nearest the target first, and never rotated by the pick offset.
    expect(query.sql).toContain('ORDER BY ABS(rating - ?)');
    expect(query.values).toEqual([
      PUZZLE_MIN_POPULARITY,
      PUZZLE_MIN_PLAYS,
      3000,
      50,
    ]);
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
      namespace: '',
      rating: 1200,
      halfWindow: 400,
      ownerId: 'u1',
      historyFilter: 'neverSeen',
      themes: ['fork'],
      currentPuzzleId: null,
    });
    expect(query.sql).toContain('COUNT(*)');
    expect(query.sql).not.toContain('LIMIT');
    expect(query.values).toContain('"fork"');
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
    exhausted: empty,
    puzzleId: 'b',
    localPuzzleTotal: 500,
    poolReady: true,
    online: true,
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
        poolReady: false,
      })
    ).toBe(true);
    // Once the pool hydrated with nothing, the screen must settle (empty state).
    expect(
      computeNextPuzzleLoading({
        ...base,
        banded: empty,
        fallback: empty,
        puzzleId: null,
        localPuzzleTotal: 0,
        poolReady: true,
      })
    ).toBe(false);
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

describe('computeNextPuzzleLoading offline', () => {
  const empty = { rows: [], isLoading: false };
  const widened = { rows: [{ id: 'far', rating: 1300 }], isLoading: false };

  // regression: puzzle-offline-band-wait
  test('offline, an empty window falls back to what is on the device', () => {
    // The rating crossed a band edge offline: the new bands can never
    // download, so waiting for them froze the feed with puzzles left.
    const offlinePastBandEdge = {
      myId: 'user_1',
      banded: empty,
      fallback: widened,
      exhausted: empty,
      puzzleId: 'far',
      localPuzzleTotal: 0,
      poolReady: false,
      online: false,
    };
    expect(computeNextPuzzleLoading(offlinePastBandEdge)).toBe(false);
    // Online, the same window still waits for its bands to land.
    expect(
      computeNextPuzzleLoading({ ...offlinePastBandEdge, online: true })
    ).toBe(true);
  });

  test('offline with nothing on the device settles instead of spinning', () => {
    expect(
      computeNextPuzzleLoading({
        myId: 'user_1',
        banded: empty,
        fallback: empty,
        exhausted: empty,
        puzzleId: null,
        localPuzzleTotal: 0,
        poolReady: false,
        online: false,
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

describe('buildPuzzleBandCountSql', () => {
  test('counts only the active rating window', () => {
    const query = buildPuzzleBandCountSql({
      namespace: '',
      rating: 1500,
      halfWindow: 400,
    });
    expect(query.sql.replace(/\s+/g, ' ')).toContain(
      'SELECT COUNT(*) AS value FROM chess_puzzles WHERE deleted_at IS NULL'
    );
    expect(query.values).toEqual([1100, 1900]);
  });

  test('counts the whole catalog without a window', () => {
    const query = buildPuzzleBandCountSql({
      namespace: '',
      rating: 1500,
      halfWindow: null,
    });
    expect(query.sql.replace(/\s+/g, ' ')).not.toContain('rating >=');
    expect(query.values).toEqual([]);
  });
});

describe('§9 selection window', () => {
  test('±200 while the deviation is maximal, ±100 once settled', () => {
    expect(puzzleSelectionHalfWindow(PUZZLE_RATING_DEFAULT_RD)).toBe(
      PUZZLE_WINDOW_HALF_MAX
    );
    expect(puzzleSelectionHalfWindow(PUZZLE_RATING_RD_MIN)).toBe(
      PUZZLE_WINDOW_HALF_MIN
    );
    expect(puzzleSelectionHalfWindow(0)).toBe(PUZZLE_WINDOW_HALF_MIN);
    expect(puzzleSelectionHalfWindow(Number.NaN)).toBe(PUZZLE_WINDOW_HALF_MAX);
  });

  test('the window widens monotonically with the deviation', () => {
    let previous = 0;
    for (let rd = PUZZLE_RATING_RD_MIN; rd <= PUZZLE_RATING_DEFAULT_RD; rd++) {
      const half = puzzleSelectionHalfWindow(rd);
      expect(half).toBeGreaterThanOrEqual(previous);
      expect(half).toBeGreaterThanOrEqual(PUZZLE_WINDOW_HALF_MIN);
      expect(half).toBeLessThanOrEqual(PUZZLE_WINDOW_HALF_MAX);
      previous = half;
    }
  });
});

describe('§9 quality filter', () => {
  test('every candidate read carries the popularity and play-count bars', () => {
    for (const query of [
      buildPuzzleCandidatesSql({
        namespace: '',
        rating: 1500,
        halfWindow: 200,
        ownerId: 'user_1',
        historyFilter: 'neverSeen',
        themes: [],
        currentPuzzleId: null,
      }),
      buildPuzzleMatchedCountSql({
        namespace: '',
        rating: 1500,
        halfWindow: 200,
        ownerId: 'user_1',
        historyFilter: 'neverSeen',
        themes: [],
        currentPuzzleId: null,
      }),
      buildExhaustedPuzzleCandidatesSql({
        namespace: '',
        ownerId: 'user_1',
        themes: [],
        currentPuzzleId: null,
      }),
    ]) {
      expect(query.sql).toContain('popularity >= ?');
      expect(query.sql).toContain('nb_plays >= ?');
      expect(query.values).toContain(PUZZLE_MIN_POPULARITY);
      expect(query.values).toContain(PUZZLE_MIN_PLAYS);
    }
  });
});

describe('§9 exhausted pool', () => {
  test('reads attempted puzzles, oldest attempt first, with no rating window', () => {
    const query = buildExhaustedPuzzleCandidatesSql({
      namespace: '',
      ownerId: 'user_1',
      themes: [],
      currentPuzzleId: 'current',
    });
    const normalized = query.sql.replace(/\s+/g, ' ');
    expect(normalized).toContain(
      'id IN ( SELECT puzzle_id FROM chess_puzzle_interactions'
    );
    expect(normalized).toContain(
      'ORDER BY last_order ASC, last_at ASC, id ASC'
    );
    expect(normalized).not.toContain('rating >=');
    expect(query.values).toContain('current');
  });
});

describe('pickNextPuzzle', () => {
  const inWindow = { rows: [{ id: 'near', rating: 1500 }], isLoading: false };
  const anywhere = { rows: [{ id: 'far', rating: 2600 }], isLoading: false };
  const none = { rows: [], isLoading: false };
  const played = [
    { id: 'old', rating: 900, last_at: '2026-01-01T00:00:00.000Z' },
    { id: 'recent', rating: 900, last_at: '2026-02-01T00:00:00.000Z' },
  ];

  test('serves an unseen in-window puzzle first', () => {
    expect(
      pickNextPuzzle({
        banded: inWindow,
        fallback: anywhere,
        exhausted: played,
        rating: 1500,
        seed: 'seed-1',
      })
    ).toEqual({ puzzleId: 'near', source: 'unseen' });
  });

  test('widens past the window before touching played puzzles', () => {
    expect(
      pickNextPuzzle({
        banded: none,
        fallback: anywhere,
        exhausted: played,
        rating: 1500,
        seed: 'seed-1',
      })
    ).toEqual({ puzzleId: 'far', source: 'widened' });
  });

  test('exhausted pool serves the oldest attempt, in order', () => {
    expect(
      pickNextPuzzle({
        banded: none,
        fallback: none,
        exhausted: played,
        rating: 1500,
        seed: 'seed-1',
      })
    ).toEqual({ puzzleId: 'old', source: 'exhausted' });
    // Deterministic: the seed never reorders the exhausted page.
    expect(
      pickNextPuzzle({
        banded: none,
        fallback: none,
        exhausted: played,
        rating: 1500,
        seed: 'another-seed',
      })
    ).toEqual({ puzzleId: 'old', source: 'exhausted' });
  });

  test('nothing anywhere is an empty pick', () => {
    expect(
      pickNextPuzzle({
        banded: none,
        fallback: none,
        exhausted: [],
        rating: 1500,
        seed: 'seed-1',
      })
    ).toEqual({ puzzleId: null, source: null });
  });
});

describe('§9 the window waits for its own hydrate', () => {
  const empty = { rows: [], isLoading: false };
  const rows = { rows: [{ id: 'far', rating: 900 }], isLoading: false };

  test('an empty window keeps loading until the pool is ready', () => {
    const base = {
      myId: 'user_1',
      banded: empty,
      fallback: rows,
      exhausted: empty,
      puzzleId: 'far',
      localPuzzleTotal: 3,
      online: true,
    };
    expect(computeNextPuzzleLoading({ ...base, poolReady: false })).toBe(true);
    expect(computeNextPuzzleLoading({ ...base, poolReady: true })).toBe(false);
  });
});
