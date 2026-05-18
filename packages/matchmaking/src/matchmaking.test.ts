import { PGlite } from '@electric-sql/pglite';
import { Assert } from '@gamezilla/lib/assert';
import {
  createAttrNamespace,
  type AttributeState,
} from '@gamezilla/lib/attribute';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { Matchmaking, type MatchmakingOptions } from './matchmaking';
import { createPgliteSqlClient } from './pglite-adapter';
import type { DistanceFormula, MatchedStatus } from './types';

const testNs = createAttrNamespace('mmtest');

const RatingAttr = testNs('rating', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/rating must be a finite number');
  }
  return v;
});

const SkillAttr = testNs('skill', (v): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('mmtest/skill must be a finite number');
  }
  return v;
});

const NameAttr = testNs('name', (v): string =>
  typeof v === 'string' ? v : ''
);

const RegionAttr = testNs('region', (v): string | undefined =>
  typeof v === 'string' ? v : undefined
);

const KindAttr = testNs('kind', (v): string => {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error('mmtest/kind must be a non-empty string');
  }
  return v;
});

const SimpleFormula: DistanceFormula = {
  numeric: [{ tag: RatingAttr, weight: 1 }],
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${message} ${JSON.stringify(context)}`
      );
    },
  });
});
afterAll(() => {
  disposeTestCrashHandler();
});

type Harness = {
  db: PGlite;
  mm: Matchmaking;
};

// The v3 schema removes SQL-side throttling entirely (the ticker DO is
// the sole caller of pass/sweep, so no throttle row is needed). Tests
// just construct a fresh Matchmaking and drive `tick()` explicitly.
async function bootHarness(
  overrides?: Partial<Pick<MatchmakingOptions, 'schema' | 'tuning'>>
): Promise<Harness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  const schema = overrides?.schema ?? {};
  const mm = new Matchmaking({
    storage: { sqlClient },
    schema,
    ...(overrides?.tuning !== undefined ? { tuning: overrides.tuning } : {}),
  });
  await mm.ready();
  return { db, mm };
}

let h: Harness;
beforeEach(async () => {
  h = await bootHarness();
});
afterEach(async () => {
  await h.db.close();
});

function expectMatched(status: unknown): MatchedStatus {
  expect(status).not.toBeNull();
  const narrowed = status as MatchedStatus;
  expect(narrowed.status).toBe('matched');
  return narrowed;
}

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
    const fresh = await bootHarness();
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
    // `nowRef` is captured by the tuning closure BEFORE bootHarness so the
    // first read happens after boot is finished. This avoids the trap of
    // anchoring simulated time to a `Date.now()` taken before the
    // multi-second PGlite + migrate startup.
    const nowRef = { value: 0 };
    const isolated = await bootHarness({
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
    const isolated = await bootHarness({ tuning: { now: () => now } });
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
    const isolated = await bootHarness({ tuning: { now: () => now } });
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
    const partitioned = await bootHarness({
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

    const plain = await bootHarness();
    try {
      for (const r of [1000, 1010, 1100, 1110, 1200, 1210]) {
        await plain.mm.join({ data: RatingAttr(r), formulas });
      }
      const plainPairs = await plain.mm.tick({ maxPassesPerPartition: 32 });

      const bucketed = await bootHarness({
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
    const isolated = await bootHarness({
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
    const isolated = await bootHarness({
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
  // count is right) — but real Postgres + Hyperdrive will pipeline
  // the 8 drains for the actual scale win.
  test('drains 8 partitions concurrently and produces all pairs', async () => {
    const partitioned = await bootHarness({
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
    const partitioned = await bootHarness({
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
  test('rejects storage missing both pool and sqlClient', () => {
    expect(
      () =>
        new Matchmaking({
          storage: {} as unknown as { pool: never },
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
