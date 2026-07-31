import { PGlite } from '@electric-sql/pglite';
import type { AttributeState } from '@pkgs/attribute';
import { sqlMap, type Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import {
  Matchmaking,
  MATCHMAKING_PAYLOAD_LIMITS,
  MatchmakingSchemaDriftError,
} from './matchmaking';
import { createPgliteSqlClient } from './pglite-adapter';
import {
  bootMatchmaking,
  expectMatched,
  KindAttr,
  NameAttr,
  pauseForJoinedAtOrdering,
  RatingAttr,
  RegionAttr,
  registerTestCrashHandler,
  SkillAttr,
  UUID_REGEX,
  type MmHarness,
} from './test-harness';
import type { DistanceFormula } from './types';

const SimpleFormula: DistanceFormula = {
  numeric: [{ tag: RatingAttr, weight: 1 }],
};

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = registerTestCrashHandler();
});
afterAll(() => {
  disposeTestCrashHandler();
});

let h: MmHarness;
beforeEach(async () => {
  h = await bootMatchmaking();
});
afterEach(async () => {
  await h.db.close();
});

describe('Matchmaking.join / status / leave', () => {
  test('round-trips participant data through status while waiting', async () => {
    const joined = await h.mm.join({
      data: { ...RatingAttr(1500), ...NameAttr('alice') },
      formulas: [SimpleFormula],
    });
    expect(typeof joined.participantId).toBe('string');

    const status = await h.mm.status(joined.participantId);
    expect(status).not.toBeNull();
    expect(status?.status).toBe('waiting');
    expect(status?.data as Record<string, unknown>).toEqual({
      'mmtest/rating': 1500,
      'mmtest/name': 'alice',
    });
  });

  test('status returns null for unknown id', async () => {
    const missing = await h.mm.status('00000000-0000-0000-0000-000000000000');
    expect(missing).toBeNull();
  });

  test('leave removes the row', async () => {
    const { participantId } = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const result = await h.mm.leave(participantId);
    expect(result.removed).toBe(true);
    expect(await h.mm.status(participantId)).toBeNull();
  });

  test('ready() is idempotent and resolves after migrate', async () => {
    await h.mm.ready();
    await h.mm.ready();
    // join works without an explicit ready() — every method awaits the
    // same cached boot promise internally.
    const fresh = await bootMatchmaking();
    try {
      const joined = await fresh.mm.join({
        data: RatingAttr(900),
        formulas: [SimpleFormula],
      });
      expect(joined.participantId).toBeDefined();
    } finally {
      await fresh.db.close();
    }
  });
});

describe('Matchmaking.join asserts', () => {
  test('throws on empty formulas array', async () => {
    await expect(
      h.mm.join({ data: RatingAttr(1000), formulas: [] })
    ).rejects.toThrow();
  });

  test('throws on empty formula (no terms)', async () => {
    await expect(
      h.mm.join({ data: RatingAttr(1000), formulas: [{ numeric: [] }] })
    ).rejects.toThrow();
  });

  test('throws on negative numeric weight', async () => {
    await expect(
      h.mm.join({
        data: RatingAttr(1000),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: -1 }] }],
      })
    ).rejects.toThrow();
  });

  test('throws when required numeric attr is missing', async () => {
    await expect(
      h.mm.join({ data: NameAttr('orphan'), formulas: [SimpleFormula] })
    ).rejects.toThrow();
  });

  test('throws when data contains a non-keyword key', async () => {
    await expect(
      h.mm.join({
        data: { badkey: 1 } as unknown as AttributeState,
        formulas: [SimpleFormula],
      })
    ).rejects.toThrow();
  });
});

describe('Matchmaking - status/peers contract', () => {
  test('paired participants see the same matchId and each other as peers', async () => {
    const a = await h.mm.join({
      data: { ...RatingAttr(1000), ...NameAttr('a') },
      formulas: [SimpleFormula],
    });
    const b = await h.mm.join({
      data: { ...RatingAttr(1020), ...NameAttr('b') },
      formulas: [SimpleFormula],
    });

    // Drive the queue to completion via tick (would normally happen
    // opportunistically via /join + /status on the Hono app).
    const drained = await h.mm.tick({ maxPassesPerPartition: 4 });
    expect(drained.matches).toBe(1);

    const aStatus = expectMatched(await h.mm.status(a.participantId));
    const bStatus = expectMatched(await h.mm.status(b.participantId));
    expect(aStatus.matchId).toMatch(UUID_REGEX);
    expect(aStatus.matchId).toBe(bStatus.matchId);
    expect(aStatus.peers.map((p) => p.participantId)).toEqual([
      b.participantId,
    ]);
    expect(bStatus.peers.map((p) => p.participantId)).toEqual([
      a.participantId,
    ]);
    expect(
      aStatus.peers.map(
        (p) => (p.data as Record<string, unknown>)['mmtest/name']
      )
    ).toEqual(['b']);
  });

  test('three participants — only the closest pair matches', async () => {
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const b = await h.mm.join({
      data: RatingAttr(1020),
      formulas: [SimpleFormula],
    });
    const c = await h.mm.join({
      data: RatingAttr(2000),
      formulas: [SimpleFormula],
    });
    await h.mm.tick({ maxPassesPerPartition: 4 });
    expect((await h.mm.status(a.participantId))?.status).toBe('matched');
    expect((await h.mm.status(b.participantId))?.status).toBe('matched');
    expect((await h.mm.status(c.participantId))?.status).toBe('waiting');
  });
});

describe('Matchmaking - formula behaviors', () => {
  test('combined numeric formula respects summed distance', async () => {
    const closeFormula: DistanceFormula = {
      numeric: [
        { tag: RatingAttr, weight: 1 },
        { tag: SkillAttr, weight: 0.5 },
      ],
    };
    await h.mm.join({
      data: { ...RatingAttr(1000), ...SkillAttr(50) },
      formulas: [closeFormula],
    });
    await h.mm.join({
      data: { ...RatingAttr(1030), ...SkillAttr(80) },
      formulas: [closeFormula],
    });
    const drained = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(drained.matches).toBe(1);
  });

  test('categorical penalty + simulated clock — same region pairs, different regions need wait', async () => {
    // `nowRef` is captured by the tuning closure BEFORE bootMatchmaking so the
    // first read happens after boot is finished. This avoids the trap of
    // anchoring simulated time to a `Date.now()` taken before the
    // multi-second PGlite + migrate startup.
    const nowRef = { value: 0 };
    const isolated = await bootMatchmaking({
      tuning: { now: () => nowRef.value },
    });
    try {
      nowRef.value = Date.now();
      const regionFormula: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        categorical: [{ tag: RegionAttr, penalty: 75 }],
      };
      await isolated.mm.join({
        data: { ...RatingAttr(1000), ...RegionAttr('us-east') },
        formulas: [regionFormula],
      });
      await isolated.mm.join({
        data: { ...RatingAttr(1000), ...RegionAttr('eu-west') },
        formulas: [regionFormula],
      });
      const first = await isolated.mm.tick({ maxPassesPerPartition: 1 });
      expect(first.matches).toBe(0);
      nowRef.value += 30_000;
      const second = await isolated.mm.tick({ maxPassesPerPartition: 1 });
      expect(second.matches).toBe(1);
    } finally {
      await isolated.db.close();
    }
  });

  test('partition (hard-equality) never crosses partitions even at max wait', async () => {
    let now = Date.now();
    const isolated = await bootMatchmaking({ tuning: { now: () => now } });
    try {
      const kindFormula: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        partition: [{ tag: KindAttr }],
      };
      await isolated.mm.join({
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas: [kindFormula],
      });
      await isolated.mm.join({
        data: { ...RatingAttr(1000), ...KindAttr('beta') },
        formulas: [kindFormula],
      });
      now += 60_000;
      const drained = await isolated.mm.tick({ maxPassesPerPartition: 4 });
      expect(drained.matches).toBe(0);
    } finally {
      await isolated.db.close();
    }
  });

  test('OR-of-formulas pairs when any pair is mutually accepted', async () => {
    const alpha: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const beta: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const a = await h.mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [alpha, beta],
    });
    const b = await h.mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('alpha') },
      formulas: [alpha],
    });
    await h.mm.tick({ maxPassesPerPartition: 1 });
    const aStatus = expectMatched(await h.mm.status(a.participantId));
    expect(aStatus.peers[0]?.participantId).toBe(b.participantId);
  });

  test('asymmetric formulas: B partition rejects pair A would accept', async () => {
    let now = Date.now();
    const isolated = await bootMatchmaking({ tuning: { now: () => now } });
    try {
      const open: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
      };
      const gated: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        partition: [{ tag: KindAttr }],
      };
      await isolated.mm.join({
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas: [open],
      });
      await isolated.mm.join({
        data: { ...RatingAttr(1010), ...KindAttr('beta') },
        formulas: [gated],
      });
      const first = await isolated.mm.tick({ maxPassesPerPartition: 1 });
      expect(first.matches).toBe(0);
      now += 60_000;
      const second = await isolated.mm.tick({ maxPassesPerPartition: 1 });
      expect(second.matches).toBe(0);
    } finally {
      await isolated.db.close();
    }
  });
});

describe('Matchmaking - partition schema', () => {
  test('declared partitionKeys isolate participants across shards', async () => {
    const partitioned = await bootMatchmaking({
      schema: { partitionKeys: [KindAttr.key] },
    });
    try {
      const formulas = [SimpleFormula];

      const a1 = await partitioned.mm.join({
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas,
      });
      const a2 = await partitioned.mm.join({
        data: { ...RatingAttr(1010), ...KindAttr('alpha') },
        formulas,
      });
      const b1 = await partitioned.mm.join({
        data: { ...RatingAttr(1000), ...KindAttr('beta') },
        formulas,
      });
      const b2 = await partitioned.mm.join({
        data: { ...RatingAttr(1010), ...KindAttr('beta') },
        formulas,
      });

      const drained = await partitioned.mm.tick({
        maxPassesPerPartition: 8,
      });
      expect(drained.matches).toBe(2);
      expect(drained.partitions).toBe(2);

      const a1Status = expectMatched(
        await partitioned.mm.status(a1.participantId)
      );
      const b1Status = expectMatched(
        await partitioned.mm.status(b1.participantId)
      );
      expect(a1Status.peers[0]?.participantId).toBe(a2.participantId);
      expect(b1Status.peers[0]?.participantId).toBe(b2.participantId);
      expect(a1Status.matchId).not.toBe(b1Status.matchId);
    } finally {
      await partitioned.db.close();
    }
  });

  test('bucketing produces the same matches as a non-bucketed schema', async () => {
    const formulas = [SimpleFormula];

    const plain = await bootMatchmaking();
    try {
      for (const r of [1000, 1010, 1100, 1110, 1200, 1210]) {
        await plain.mm.join({ data: RatingAttr(r), formulas });
      }
      const plainPairs = await plain.mm.tick({ maxPassesPerPartition: 32 });

      const bucketed = await bootMatchmaking({
        schema: {
          partitionKeys: [],
          primaryNumericKey: RatingAttr.key,
          bucketWidth: 25,
        },
      });
      try {
        for (const r of [1000, 1010, 1100, 1110, 1200, 1210]) {
          await bucketed.mm.join({ data: RatingAttr(r), formulas });
        }
        const bucketedPairs = await bucketed.mm.tick({
          maxPassesPerPartition: 32,
        });
        expect(bucketedPairs.matches).toBe(plainPairs.matches);
        expect(plainPairs.matches).toBe(3);
      } finally {
        await bucketed.db.close();
      }
    } finally {
      await plain.db.close();
    }
  });
});

describe('Matchmaking.tick - sweeps', () => {
  test('expiredRemoved reaps waiters older than maxWaitSeconds', async () => {
    const nowRef = { value: 0 };
    const isolated = await bootMatchmaking({
      tuning: {
        now: () => nowRef.value,
        maxWaitSeconds: 30,
      },
    });
    try {
      nowRef.value = Date.now();
      const { participantId } = await isolated.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      // Nothing to reap yet — the row is fresh.
      const fresh = await isolated.mm.tick();
      expect(fresh.expiredRemoved).toBe(0);
      expect((await isolated.mm.status(participantId))?.status).toBe('waiting');

      // Age past maxWaitSeconds.
      nowRef.value += 120_000;
      const swept = await isolated.mm.tick();
      expect(swept.expiredRemoved).toBe(1);
      expect(await isolated.mm.status(participantId)).toBeNull();
    } finally {
      await isolated.db.close();
    }
  });

  test('matchedRemoved reaps matched rows older than matchedRetentionSeconds', async () => {
    const nowRef = { value: 0 };
    const isolated = await bootMatchmaking({
      tuning: {
        now: () => nowRef.value,
        matchedRetentionSeconds: 10,
      },
    });
    try {
      nowRef.value = Date.now();
      const a = await isolated.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      const b = await isolated.mm.join({
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
      });
      const drained = await isolated.mm.tick({ maxPassesPerPartition: 1 });
      expect(drained.matches).toBe(1);
      expect(drained.matchedRemoved).toBe(0);
      expectMatched(await isolated.mm.status(a.participantId));
      expectMatched(await isolated.mm.status(b.participantId));

      // Age past matchedRetentionSeconds.
      nowRef.value += 60_000;
      const swept = await isolated.mm.tick();
      expect(swept.matchedRemoved).toBe(2);
      expect(await isolated.mm.status(a.participantId)).toBeNull();
      expect(await isolated.mm.status(b.participantId)).toBeNull();
    } finally {
      await isolated.db.close();
    }
  });

  test('tick on an empty queue is a clean no-op', async () => {
    const res = await h.mm.tick();
    expect(res.matches).toBe(0);
    expect(res.passes).toBe(0);
    expect(res.partitions).toBe(0);
    expect(res.expiredRemoved).toBe(0);
    expect(res.matchedRemoved).toBe(0);
  });
});

describe('Matchmaking.tick - parallel drain across partitions', () => {
  // 8 partitions × 5 pairs each. With concurrency: 8 the partition
  // drains overlap on the SQL side instead of running sequentially.
  // PGlite serialises all queries through a single connection so we
  // can only assert correctness (every partition drains, total pair
  // count is right) — but real Postgres will pipeline
  // the 8 drains for the actual scale win.
  test('drains 8 partitions concurrently and produces all pairs', async () => {
    const partitioned = await bootMatchmaking({
      schema: { partitionKeys: ['mmtest/region'] },
    });
    try {
      const formula: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        partition: [{ tag: RegionAttr }],
      };
      const regions = Array.from({ length: 8 }, (_, i) => `r${String(i)}`);
      for (const region of regions) {
        for (let i = 0; i < 10; i += 1) {
          await partitioned.mm.join({
            data: {
              ...RatingAttr(1000 + i * 5),
              ...RegionAttr(region),
            } as AttributeState,
            formulas: [formula],
          });
        }
      }
      const drained = await partitioned.mm.tick({
        concurrency: 8,
        maxPassesPerPartition: 32,
      });
      expect(drained.partitions).toBe(8);
      expect(drained.matches).toBe(40);
    } finally {
      await partitioned.db.close();
    }
  });

  test('after a full drain, discoverActivePartitions prunes empty signatures', async () => {
    const partitioned = await bootMatchmaking({
      schema: { partitionKeys: ['mmtest/region'] },
    });
    try {
      const formula: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        partition: [{ tag: RegionAttr }],
      };
      for (let i = 0; i < 2; i += 1) {
        await partitioned.mm.join({
          data: {
            ...RatingAttr(1000 + i),
            ...RegionAttr('us-east'),
          } as AttributeState,
          formulas: [formula],
        });
      }
      const first = await partitioned.mm.tick({ maxPassesPerPartition: 4 });
      expect(first.matches).toBe(1);
      // Both rows are now in matchmaking_matched; matchmaking_waiting
      // for 'us-east' is empty. The next tick should report 0 partitions.
      const second = await partitioned.mm.tick({ maxPassesPerPartition: 4 });
      expect(second.partitions).toBe(0);
    } finally {
      await partitioned.db.close();
    }
  });
});

describe('Matchmaking - options validation', () => {
  test('rejects storage missing sqlClient', () => {
    expect(
      () =>
        new Matchmaking({
          storage: {} as unknown as { sqlClient: never },
          schema: {},
        })
    ).toThrow();
  });

  test('rejects empty-string partitionKeys entries', async () => {
    const db = await PGlite.create();
    const sqlClient = createPgliteSqlClient(db);
    try {
      expect(
        () =>
          new Matchmaking({
            storage: { sqlClient },
            schema: { partitionKeys: ['', 'mmtest/kind'] },
          })
      ).toThrow();
    } finally {
      await db.close();
    }
  });
});

// ---------------------------------------------------------------------
// Phase 2 — production hardening test gaps
// ---------------------------------------------------------------------

describe('Matchmaking.tick - bounded fan-out and cancellation', () => {
  // Drive enough joins across enough partitions that the fan-out has a
  // genuine cap to enforce. PGlite serialises through one connection so
  // any "concurrency" assertion has to instrument SQL counts instead of
  // wall-clock timing.
  async function seedPartitions(
    mm: Matchmaking,
    partitions: number,
    perPartition: number
  ): Promise<void> {
    const formula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: RegionAttr }],
    };
    for (let p = 0; p < partitions; p += 1) {
      const region = `r${String(p)}`;
      for (let i = 0; i < perPartition; i += 1) {
        await mm.join({
          data: {
            ...RatingAttr(1000 + i * 10),
            ...RegionAttr(region),
          } as AttributeState,
          formulas: [formula],
        });
      }
    }
  }

  test('respects maxPartitions (bounded discovery)', async () => {
    const h2 = await bootMatchmaking({
      schema: { partitionKeys: ['mmtest/region'] },
    });
    try {
      await seedPartitions(h2.mm, 6, 2);
      const drained = await h2.mm.tick({
        maxPartitions: 3,
        maxPassesPerPartition: 4,
      });
      expect(drained.partitions).toBe(3);
      // Only the visited partitions produced matches.
      expect(drained.matches).toBe(3);
    } finally {
      await h2.db.close();
    }
  });

  test('respects maxPassesPerPartition (bounded drain depth)', async () => {
    const h2 = await bootMatchmaking({
      schema: { partitionKeys: ['mmtest/region'] },
      tuning: { maxPairsPerPass: 1 },
    });
    try {
      // 2 partitions, 4 candidates each → would take 2 passes per
      // partition to drain at maxPairsPerPass=1. Cap at 1 pass each.
      await seedPartitions(h2.mm, 2, 4);
      const drained = await h2.mm.tick({
        maxPassesPerPartition: 1,
        concurrency: 1,
      });
      expect(drained.partitions).toBe(2);
      // Exactly one pass per partition (passes counts ALL pass calls,
      // even ones that produced 0 matches → 2 total).
      expect(drained.passes).toBe(2);
      expect(drained.matches).toBe(2);
    } finally {
      await h2.db.close();
    }
  });

  test('respects signal: abort before second partition', async () => {
    const h2 = await bootMatchmaking({
      schema: { partitionKeys: ['mmtest/region'] },
    });
    try {
      await seedPartitions(h2.mm, 4, 2);
      const ac = new AbortController();
      ac.abort();
      const drained = await h2.mm.tick({
        signal: ac.signal,
        concurrency: 1,
        maxPassesPerPartition: 1,
      });
      // The signal aborts BEFORE the parallelMap workers start a new
      // partition, so we expect zero partitions drained when the
      // controller is already aborted.
      expect(drained.partitions).toBe(4); // discovery still observed them
      expect(drained.matches).toBe(0);
    } finally {
      await h2.db.close();
    }
  });

  test('respects concurrency (peak in-flight bounded by cap)', async () => {
    const db = await PGlite.create();
    const base = createPgliteSqlClient(db);
    let inflight = 0;
    let peak = 0;
    const counting: SqlClient = {
      ...base,
      async query(query) {
        inflight += 1;
        peak = Math.max(peak, inflight);
        try {
          return await base.query(query);
        } finally {
          inflight -= 1;
        }
      },
    };
    const mm = new Matchmaking({
      storage: { sqlClient: counting },
      schema: { partitionKeys: ['mmtest/region'] },
    });
    await mm.ready();
    try {
      await seedPartitions(mm, 8, 2);
      peak = 0; // reset after warm-up + setup
      await mm.tick({ concurrency: 2, maxPassesPerPartition: 4 });
      // PGlite naturally serialises queries → effective in-flight 1.
      // The JS-side `parallelMap` would only spawn 2 lanes; even on
      // real Postgres the cap would hold. Asserting <= cap is the
      // honest contract; tighter assertions need a real backend.
      expect(peak).toBeLessThanOrEqual(2);
    } finally {
      await db.close();
    }
  });

  test('TickResult shape is complete on every code path (empty queue)', async () => {
    const res = await h.mm.tick();
    expect(res).toEqual({
      matches: 0,
      passes: 0,
      partitions: 0,
      expiredRemoved: 0,
      matchedRemoved: 0,
    });
  });
});

describe('Matchmaking.tick - advisory lock', () => {
  // PGlite has a SINGLE session and Postgres advisory locks are
  // re-entrant on the same session — `pg_try_advisory_lock` returns
  // true even when the same session already holds the lock. So we
  // CANNOT test the lock semantics by acquiring the lock first and
  // calling tick(). Instead, stub the SqlClient to control the lock
  // probe's return value directly. The real cross-session contention
  // path needs real Postgres (documented as a PGlite-only gap).
  test('returns a zero TickResult when the advisory lock probe returns false', async () => {
    const db = await PGlite.create();
    const base = createPgliteSqlClient(db);
    let lockProbeReturnsTrue = true;
    let didRunMatchPass = false;
    const stub: SqlClient = {
      ...base,
      async query<T = Record<string, unknown>>(query: Sql) {
        if (query.sql.includes('pg_try_advisory_lock')) {
          return [
            { pg_try_advisory_lock: lockProbeReturnsTrue },
          ] as unknown as T[];
        }
        if (query.sql.includes('matchmaking_run_match_pass')) {
          didRunMatchPass = true;
        }
        return await base.query<T>(query);
      },
    };
    const mm = new Matchmaking({
      storage: { sqlClient: stub },
      schema: {},
    });
    await mm.ready();
    try {
      await mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      await mm.join({
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
      });
      lockProbeReturnsTrue = false;
      const drained = await mm.tick({ maxPassesPerPartition: 4 });
      expect(drained).toEqual({
        matches: 0,
        passes: 0,
        partitions: 0,
        expiredRemoved: 0,
        matchedRemoved: 0,
      });
      expect(didRunMatchPass).toBe(false);

      // With the lock available, tick proceeds normally.
      lockProbeReturnsTrue = true;
      const second = await mm.tick({ maxPassesPerPartition: 4 });
      expect(second.matches).toBe(1);
    } finally {
      await db.close();
    }
  });

  test('releases the advisory lock after a SQL error mid-drain', async () => {
    const db = await PGlite.create();
    const base = createPgliteSqlClient(db);
    let injectError = false;
    const flaky: SqlClient = {
      ...base,
      async query(query: Sql) {
        if (injectError && query.sql.includes('matchmaking_run_match_pass')) {
          throw new Error('synthetic SQL failure mid-drain');
        }
        return await base.query(query);
      },
    };
    const mm = new Matchmaking({
      storage: { sqlClient: flaky },
      schema: {},
    });
    await mm.ready();
    try {
      await mm.join({ data: RatingAttr(1000), formulas: [SimpleFormula] });
      await mm.join({ data: RatingAttr(1010), formulas: [SimpleFormula] });
      injectError = true;
      await expect(mm.tick({ maxPassesPerPartition: 1 })).rejects.toThrow();
      injectError = false;
      // Lock must have been released — second tick can acquire it.
      const second = await mm.tick({ maxPassesPerPartition: 1 });
      expect(second.matches).toBe(1);
    } finally {
      await db.close();
    }
  });
});

describe('Matchmaking - leave edge cases', () => {
  test('returns { removed: false } for unknown id', async () => {
    const result = await h.mm.leave('00000000-0000-0000-0000-000000000000');
    expect(result.removed).toBe(false);
  });

  test('is a no-op for an already-matched participant', async () => {
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const b = await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });
    await h.mm.tick({ maxPassesPerPartition: 1 });
    expectMatched(await h.mm.status(a.participantId));
    // leave on a matched participant returns removed: false (the row
    // is in matchmaking_matched, not matchmaking_waiting) and does
    // NOT delete from matched.
    const leave = await h.mm.leave(a.participantId);
    expect(leave.removed).toBe(false);
    expectMatched(await h.mm.status(a.participantId));
    expectMatched(await h.mm.status(b.participantId));
  });
});

describe('Matchmaking - status stability', () => {
  test('status is stable across 5 repeated calls before pairing', async () => {
    const { participantId } = await h.mm.join({
      data: { ...RatingAttr(1500), ...NameAttr('stable') },
      formulas: [SimpleFormula],
    });
    for (let i = 0; i < 5; i += 1) {
      const status = await h.mm.status(participantId);
      expect(status).not.toBeNull();
      expect(status?.status).toBe('waiting');
      expect((status?.data as Record<string, unknown>)['mmtest/name']).toBe(
        'stable'
      );
    }
  });
});

describe('Matchmaking - schema drift', () => {
  test('MatchmakingSchemaDriftError on fingerprint mismatch', async () => {
    const db = await PGlite.create();
    const sqlClient = createPgliteSqlClient(db);
    try {
      const mm = new Matchmaking({
        storage: { sqlClient },
        schema: { partitionKeys: ['mmtest/region'] },
      });
      await mm.ready();
      // Corrupt the stored fingerprint to simulate another process
      // having re-migrated with a different schema.
      await sqlClient.run(
        sqlMap({
          update: 'matchmaking_schema_state',
          set: { schema_fingerprint: '{"corrupted":true}' },
          where: ['=', 'id', 1],
        })
      );
      // Build a NEW Matchmaking instance so the cached probe is fresh.
      const mm2 = new Matchmaking({
        storage: { sqlClient },
        schema: { partitionKeys: ['mmtest/region'] },
      });
      // mm2.ready() runs migrate which re-writes the fingerprint, so
      // we need to corrupt AFTER mm2 boots but BEFORE its first join.
      await mm2.ready();
      await sqlClient.run(
        sqlMap({
          update: 'matchmaking_schema_state',
          set: { schema_fingerprint: '{"corrupted":true}' },
          where: ['=', 'id', 1],
        })
      );
      await expect(
        mm2.join({
          data: {
            ...RatingAttr(1000),
            ...RegionAttr('us-east'),
          } as AttributeState,
          formulas: [SimpleFormula],
        })
      ).rejects.toThrow(MatchmakingSchemaDriftError);
    } finally {
      await db.close();
    }
  });
});

describe('Matchmaking - empty partitionKeys collapse', () => {
  test('empty partitionKeys puts everyone in one shard', async () => {
    const explicit = await bootMatchmaking({
      schema: { partitionKeys: [] },
    });
    try {
      await explicit.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      await explicit.mm.join({
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
      });
      const drained = await explicit.mm.tick({ maxPassesPerPartition: 4 });
      expect(drained.partitions).toBe(1);
      expect(drained.matches).toBe(1);
    } finally {
      await explicit.db.close();
    }
  });
});

describe('MATCHMAKING_PAYLOAD_LIMITS', () => {
  test('has stable shape and positive values', () => {
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxDataKeys).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxFormulas).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxTermsPerFormula).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxStringBytes).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes).toBeGreaterThan(0);
  });
});

describe('Matchmaking - group matching (groupSize)', () => {
  test('groupSize: 2 default behaves identically to v3 pairs (regression)', async () => {
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const b = await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(1);
    const ma = expectMatched(await h.mm.status(a.participantId));
    const mb = expectMatched(await h.mm.status(b.participantId));
    expect(ma.matchId).toBe(mb.matchId);
    expect(ma.peers).toHaveLength(1);
    expect(mb.peers).toHaveLength(1);
  });

  test('groupSize: 3 - three close-rating participants form one match', async () => {
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    const b = await h.mm.join({
      data: RatingAttr(1005),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    const c = await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(1);
    const ma = expectMatched(await h.mm.status(a.participantId));
    const mb = expectMatched(await h.mm.status(b.participantId));
    const mc = expectMatched(await h.mm.status(c.participantId));
    expect(ma.matchId).toBe(mb.matchId);
    expect(mb.matchId).toBe(mc.matchId);
    expect(ma.peers).toHaveLength(2);
    // status returns all OTHER group members for the asking participant.
    const peerIds = new Set(ma.peers.map((p) => p.participantId));
    expect(peerIds).toEqual(new Set([b.participantId, c.participantId]));
  });

  test('groupSize: 4 with 5 candidates - groups the oldest four, leaves one waiting', async () => {
    const ids = [];
    for (let i = 0; i < 5; i += 1) {
      if (i > 0) {
        await pauseForJoinedAtOrdering();
      }
      const r = await h.mm.join({
        data: RatingAttr(1000 + i * 2),
        formulas: [SimpleFormula],
        groupSize: 4,
      });
      ids.push(r.participantId);
    }
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(1);
    // First four (FIFO) get matched together.
    for (let i = 0; i < 4; i += 1) {
      const status = ids[i];
      expect(status).toBeDefined();
      const m = expectMatched(await h.mm.status(status as string));
      expect(m.peers).toHaveLength(3);
    }
    // Fifth stays waiting — no quorum of compatible peers left.
    const last = ids[4];
    expect(last).toBeDefined();
    const tail = await h.mm.status(last as string);
    expect(tail?.status).toBe('waiting');
  });

  test('mixed groupSize never cross-matches', async () => {
    const duo = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      groupSize: 2,
    });
    await h.mm.join({
      data: RatingAttr(1005),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    // groupSize:2 has no second groupSize:2 member; both groupSize:3
    // are short of quorum. Nothing matches.
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(0);
    expect((await h.mm.status(duo.participantId))?.status).toBe('waiting');
  });

  test('pairwise rejection prevents a triangle', async () => {
    // A and B accept each other; B and C accept each other; A and C
    // do NOT (their radii don't span the rating gap). A 3-group must
    // require all three pairs — so no match forms even though the
    // chain exists.
    //
    // Use tiny radii via a short max wait so we can rely on the base
    // radius alone.
    const tightHarness = await bootMatchmaking({
      tuning: { maxPairsPerPass: 100 },
    });
    try {
      await tightHarness.mm.join({
        data: RatingAttr(1000),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
        groupSize: 3,
      });
      await tightHarness.mm.join({
        data: RatingAttr(1050),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
        groupSize: 3,
      });
      await tightHarness.mm.join({
        data: RatingAttr(1100),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
        groupSize: 3,
      });
      const tick = await tightHarness.mm.tick({ maxPassesPerPartition: 1 });
      // The default base radius is 75 — A↔B (50) ok, B↔C (50) ok,
      // A↔C (100) > 75. So pairwise rejection kicks in.
      expect(tick.matches).toBe(0);
    } finally {
      await tightHarness.db.close();
    }
  });

  test('rejects groupSize: 1 (below minimum)', async () => {
    await expect(
      h.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        groupSize: 1,
      })
    ).rejects.toThrow();
  });

  test('rejects groupSize: 17 (above maximum)', async () => {
    await expect(
      h.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        groupSize: 17,
      })
    ).rejects.toThrow();
  });

  test('rejects non-integer groupSize', async () => {
    await expect(
      h.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        groupSize: 2.5,
      })
    ).rejects.toThrow();
  });

  test('active_partitions tracks (signature, groupSize) pairs separately', async () => {
    const db = await PGlite.create();
    const sqlClient = createPgliteSqlClient(db);
    const mm = new Matchmaking({
      storage: { sqlClient },
      schema: { partitionKeys: ['mmtest/region'] },
    });
    await mm.ready();
    try {
      await mm.join({
        data: {
          ...RatingAttr(1000),
          ...RegionAttr('us-east'),
        } as AttributeState,
        formulas: [SimpleFormula],
        groupSize: 2,
      });
      await mm.join({
        data: {
          ...RatingAttr(1010),
          ...RegionAttr('us-east'),
        } as AttributeState,
        formulas: [SimpleFormula],
        groupSize: 3,
      });
      const rows = await sqlClient.query<{
        partition_signature: string;
        group_size: number | string;
      }>(
        sqlMap({
          select: ['partition_signature', 'group_size'],
          from: 'matchmaking_active_partitions',
          orderBy: ['group_size'],
        })
      );
      expect(rows).toHaveLength(2);
      const groupSizes = rows.map((r) =>
        typeof r.group_size === 'string'
          ? Number.parseInt(r.group_size, 10)
          : r.group_size
      );
      expect(groupSizes).toEqual([2, 3]);
      // Both share the same partition signature.
      expect(new Set(rows.map((r) => r.partition_signature)).size).toBe(1);
    } finally {
      await db.close();
    }
  });
});

describe('Matchmaking - per-formula radius', () => {
  test('stricter side bounds the match (asymmetric radius)', async () => {
    // A has the default radius (50). B's formula carries an override
    // that is too tight (10) to accept the rating gap of 30. Even
    // though A would accept B, B's per-formula radius rejects so
    // overall pair does not match.
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
    });
    const b = await h.mm.join({
      data: RatingAttr(1030),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: {
            baseRadius: 10,
            radiusGrowthPerSecond: 0,
            maxRadius: 10,
          },
        },
      ],
    });
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(0);
    expect((await h.mm.status(a.participantId))?.status).toBe('waiting');
    expect((await h.mm.status(b.participantId))?.status).toBe('waiting');
  });

  test('per-formula radius LOOSER than global lets pair match', async () => {
    // Both formulas allow up to 200 via per-formula override. Global
    // default 50 would reject this rating gap of 100.
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: {
            baseRadius: 200,
            radiusGrowthPerSecond: 0,
            maxRadius: 200,
          },
        },
      ],
    });
    const b = await h.mm.join({
      data: RatingAttr(1100),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: {
            baseRadius: 200,
            radiusGrowthPerSecond: 0,
            maxRadius: 200,
          },
        },
      ],
    });
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(1);
    const ma = expectMatched(await h.mm.status(a.participantId));
    expect(ma.peers[0]?.participantId).toBe(b.participantId);
  });
});

describe('Matchmaking - priority', () => {
  test('high-priority joiner is matched before a same-bucket FIFO peer', async () => {
    // a (rating 1000) joins first with no priority and a formula that
    // never accepts anyone (radius 0). b (rating 1005) joins second
    // with priority 100. c (rating 1010) joins last. The pass should
    // match b with c (priority bumps b to seed; a's tight radius
    // means a can't seed any group).
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: { baseRadius: 0, radiusGrowthPerSecond: 0, maxRadius: 0 },
        },
      ],
    });
    await pauseForJoinedAtOrdering();
    const b = await h.mm.join({
      data: RatingAttr(1005),
      formulas: [SimpleFormula],
      priority: 100,
    });
    await pauseForJoinedAtOrdering();
    const c = await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(1);
    const sb = expectMatched(await h.mm.status(b.participantId));
    expect(sb.peers[0]?.participantId).toBe(c.participantId);
    expect((await h.mm.status(a.participantId))?.status).toBe('waiting');
  });

  test('equal-priority falls back to FIFO (joined_at)', async () => {
    const first = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      priority: 0,
    });
    await pauseForJoinedAtOrdering();
    const second = await h.mm.join({
      data: RatingAttr(1005),
      formulas: [SimpleFormula],
      priority: 0,
    });
    await pauseForJoinedAtOrdering();
    const third = await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
      priority: 0,
    });
    const tick = await h.mm.tick({ maxPassesPerPartition: 1 });
    expect(tick.matches).toBe(1);
    // First two FIFO get matched (priority is uniform, so falls to joined_at).
    const sFirst = expectMatched(await h.mm.status(first.participantId));
    expect(sFirst.peers[0]?.participantId).toBe(second.participantId);
    expect((await h.mm.status(third.participantId))?.status).toBe('waiting');
  });

  test('rejects priority below -1000', async () => {
    await expect(
      h.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        priority: -1001,
      })
    ).rejects.toThrow();
  });

  test('rejects priority above 1000', async () => {
    await expect(
      h.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        priority: 1001,
      })
    ).rejects.toThrow();
  });

  test('rejects non-integer priority', async () => {
    await expect(
      h.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        priority: 1.5,
      })
    ).rejects.toThrow();
  });

  test('priority does not cross partition boundaries', async () => {
    const part = await bootMatchmaking({
      schema: { partitionKeys: ['mmtest/region'] },
    });
    try {
      const a = await part.mm.join({
        data: {
          ...RatingAttr(1000),
          ...RegionAttr('us-east'),
        } as AttributeState,
        formulas: [SimpleFormula],
        priority: 1000,
      });
      await part.mm.join({
        data: {
          ...RatingAttr(1010),
          ...RegionAttr('eu-west'),
        } as AttributeState,
        formulas: [SimpleFormula],
        priority: 1000,
      });
      const tick = await part.mm.tick({ maxPassesPerPartition: 1 });
      expect(tick.matches).toBe(0);
      expect((await part.mm.status(a.participantId))?.status).toBe('waiting');
    } finally {
      await part.db.close();
    }
  });
});

describe('Matchmaking - metadata', () => {
  test('metadata round-trips through waiting status', async () => {
    const { participantId } = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      metadata: { roomHint: 'lobby-42', avatarUrl: 'https://x/y.png' },
    });
    const status = await h.mm.status(participantId);
    expect(status?.status).toBe('waiting');
    expect(status?.metadata).toEqual({
      roomHint: 'lobby-42',
      avatarUrl: 'https://x/y.png',
    });
  });

  test('metadata round-trips through matched status (self + peers)', async () => {
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      metadata: { tag: 'A' },
    });
    const b = await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
      metadata: { tag: 'B' },
    });
    await h.mm.tick({ maxPassesPerPartition: 1 });
    const sa = expectMatched(await h.mm.status(a.participantId));
    expect(sa.metadata).toEqual({ tag: 'A' });
    expect(sa.peers[0]?.metadata).toEqual({ tag: 'B' });
    const sb = expectMatched(await h.mm.status(b.participantId));
    expect(sb.metadata).toEqual({ tag: 'B' });
    expect(sb.peers[0]?.metadata).toEqual({ tag: 'A' });
  });

  test('omitted metadata is null in status', async () => {
    const { participantId } = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const status = await h.mm.status(participantId);
    expect(status?.metadata).toBeNull();
  });

  test('explicit null metadata is treated as omitted', async () => {
    const { participantId } = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      metadata: null,
    });
    const status = await h.mm.status(participantId);
    expect(status?.metadata).toBeNull();
  });

  test('metadata cap enforced (>1024 UTF-8 bytes rejected)', async () => {
    const big = { blob: 'x'.repeat(2048) };
    await expect(
      h.mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        metadata: big,
      })
    ).rejects.toThrow();
  });
});

describe('Matchmaking - updateFormulas', () => {
  test('widening criteria mid-wait allows a previously-rejected peer to match', async () => {
    // a joins with a tight per-formula radius that excludes b.
    // b joins with a wide per-formula radius so b would accept; only
    // a is the blocker. Widening a's radius unblocks the pair.
    const wideRadius = {
      baseRadius: 500,
      radiusGrowthPerSecond: 0,
      maxRadius: 500,
    };
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: {
            baseRadius: 10,
            radiusGrowthPerSecond: 0,
            maxRadius: 10,
          },
        },
      ],
    });
    const b = await h.mm.join({
      data: RatingAttr(1100),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: wideRadius,
        },
      ],
    });
    expect((await h.mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(0);

    const upd = await h.mm.updateFormulas(a.participantId, [
      {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        radius: wideRadius,
      },
    ]);
    expect(upd.updated).toBe(true);

    expect((await h.mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
    const sa = expectMatched(await h.mm.status(a.participantId));
    expect(sa.peers[0]?.participantId).toBe(b.participantId);
  });

  test('updateFormulas returns { updated: false } for already-matched participant', async () => {
    const a = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });
    await h.mm.tick({ maxPassesPerPartition: 1 });
    expectMatched(await h.mm.status(a.participantId));

    const upd = await h.mm.updateFormulas(a.participantId, [
      { numeric: [{ tag: RatingAttr, weight: 1 }] },
    ]);
    expect(upd.updated).toBe(false);
  });

  test('updateFormulas returns { updated: false } for unknown id', async () => {
    const upd = await h.mm.updateFormulas(
      '00000000-0000-0000-0000-000000000000',
      [{ numeric: [{ tag: RatingAttr, weight: 1 }] }]
    );
    expect(upd.updated).toBe(false);
  });

  test('updateFormulas preserves joined_at (FIFO position)', async () => {
    const first = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    await pauseForJoinedAtOrdering();
    const second = await h.mm.join({
      data: RatingAttr(1005),
      formulas: [SimpleFormula],
    });

    const before = await h.mm.status(first.participantId);
    // Update first's formulas.
    await h.mm.updateFormulas(first.participantId, [SimpleFormula]);
    const after = await h.mm.status(first.participantId);
    // status surface doesn't expose joined_at on the waiting side, so
    // assert behaviour: first should still match BEFORE second (FIFO
    // preserved) when a third joiner arrives.
    expect(before?.status).toBe('waiting');
    expect(after?.status).toBe('waiting');

    const third = await h.mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });
    await h.mm.tick({ maxPassesPerPartition: 1 });
    const sFirst = expectMatched(await h.mm.status(first.participantId));
    // FIFO preserved: first matched with second, third still waiting.
    expect(sFirst.peers[0]?.participantId).toBe(second.participantId);
    expect((await h.mm.status(third.participantId))?.status).toBe('waiting');
  });

  test('updateFormulas rejects invalid formulas', async () => {
    const { participantId } = await h.mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    await expect(h.mm.updateFormulas(participantId, [])).rejects.toThrow();
    await expect(
      h.mm.updateFormulas(participantId, [{ numeric: [] }])
    ).rejects.toThrow();
  });
});
