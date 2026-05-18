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
import { MAX_FORMULAS_PER_PARTICIPANT, Matchmaker } from './matchmaker';
import { migrate, type MatchmakingSchema } from './migrate';
import { createPgliteSqlClient } from './pglite-adapter';
import type { SqlClient } from './sql-client';
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

/**
 * Generic partition attribute — represents any hard partitioning key
 * (queue mode, tier, lobby, bracket, activity kind, etc.). Kept
 * deliberately abstract so tests don't pretend the library is about
 * games.
 */
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
  sqlClient: SqlClient;
};

async function bootHarness(schema?: MatchmakingSchema): Promise<Harness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  if (schema === undefined) {
    await migrate({ sqlClient });
  } else {
    await migrate({ sqlClient, schema });
  }
  return { db, sqlClient };
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

describe('Matchmaker.join / status / leave', () => {
  test('round-trips participant data through status while waiting', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const joined = await mm.join({
      data: { ...RatingAttr(1500), ...NameAttr('alice') },
      formulas: [SimpleFormula],
    });
    expect(typeof joined.participantId).toBe('string');

    const status = await mm.status(joined.participantId);
    expect(status).not.toBeNull();
    expect(status?.status).toBe('waiting');
    expect(status?.data as Record<string, unknown>).toEqual({
      'mmtest/rating': 1500,
      'mmtest/name': 'alice',
    });
  });

  test('status returns null for unknown id', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const missing = await mm.status('00000000-0000-0000-0000-000000000000');
    expect(missing).toBeNull();
  });

  test('leave removes the row', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const { participantId } = await mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const result = await mm.leave(participantId);
    expect(result.removed).toBe(true);
    expect(await mm.status(participantId)).toBeNull();
  });
});

describe('Matchmaker.runMatchPass', () => {
  test('empty queue early-returns with zero matches', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const result = await mm.runMatchPass('');
    expect(result.matches).toBe(0);
  });

  test('pairs two close-rated participants and surfaces shared matchId via status', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const a = await mm.join({
      data: { ...RatingAttr(1000), ...NameAttr('a') },
      formulas: [SimpleFormula],
    });
    const b = await mm.join({
      data: { ...RatingAttr(1020), ...NameAttr('b') },
      formulas: [SimpleFormula],
    });

    const result = await mm.runMatchPass('');
    expect(result.matches).toBe(1);

    const aStatus = expectMatched(await mm.status(a.participantId));
    const bStatus = expectMatched(await mm.status(b.participantId));
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

  test('no-match when ratings exceed both radii, then matches as time advances', async () => {
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });

    await mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    await mm.join({
      data: RatingAttr(1200),
      formulas: [SimpleFormula],
    });
    expect((await mm.runMatchPass('')).matches).toBe(0);

    // Advance the simulated clock by 30s -> radius = 50 + 30*10 = 350.
    // Each participant needs at least |1200-1000|=200 of mutual radius.
    // Both are 30s old in the matchmaker's eyes, so they qualify.
    now += 30_000;
    const result = await mm.runMatchPass('');
    expect(result.matches).toBe(1);
  });

  test('concurrent passes do not double-match the same participant', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    await mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    await mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });

    const [a, b] = await Promise.all([
      mm.runMatchPass(''),
      mm.runMatchPass(''),
    ]);
    expect(a.matches + b.matches).toBe(1);
  });

  test('three participants in the queue only match the closest pair', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const a = await mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const b = await mm.join({
      data: RatingAttr(1020),
      formulas: [SimpleFormula],
    });
    const c = await mm.join({
      data: RatingAttr(2000),
      formulas: [SimpleFormula],
    });

    expect((await mm.runMatchPass('')).matches).toBe(1);
    expect((await mm.status(a.participantId))?.status).toBe('matched');
    expect((await mm.status(b.participantId))?.status).toBe('matched');
    expect((await mm.status(c.participantId))?.status).toBe('waiting');
  });
});

describe('Matchmaker.runMatchPass with combined numeric formula', () => {
  test('combined rating+skill distance gates matching beyond per-axis radius', async () => {
    // Rating diff = 30, Skill diff = 30 -> distance = 30 + 0.5*30 = 45.
    // Within base radius 50, so they pair on the first pass.
    const closeFormula: DistanceFormula = {
      numeric: [
        { tag: RatingAttr, weight: 1 },
        { tag: SkillAttr, weight: 0.5 },
      ],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    await mm.join({
      data: { ...RatingAttr(1000), ...SkillAttr(50) },
      formulas: [closeFormula],
    });
    await mm.join({
      data: { ...RatingAttr(1030), ...SkillAttr(80) },
      formulas: [closeFormula],
    });
    expect((await mm.runMatchPass('')).matches).toBe(1);
  });

  test('combined formula refuses to pair when summed distance exceeds radius', async () => {
    // Rating diff = 40 (fits), Skill diff = 40 -> distance = 40 + 1*40 = 80 (> 50).
    const farFormula: DistanceFormula = {
      numeric: [
        { tag: RatingAttr, weight: 1 },
        { tag: SkillAttr, weight: 1 },
      ],
    };
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });
    await mm.join({
      data: { ...RatingAttr(1000), ...SkillAttr(50) },
      formulas: [farFormula],
    });
    await mm.join({
      data: { ...RatingAttr(1040), ...SkillAttr(90) },
      formulas: [farFormula],
    });
    expect((await mm.runMatchPass('')).matches).toBe(0);

    // Advance 5s -> radius = 50 + 50 = 100; distance 80 now fits.
    now += 5_000;
    expect((await mm.runMatchPass('')).matches).toBe(1);
  });
});

describe('Matchmaker.runMatchPass with categorical penalty', () => {
  test('same region pairs at base radius; different region requires more wait', async () => {
    const regionFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      categorical: [{ tag: RegionAttr, penalty: 75 }],
    };
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });

    // Different regions: distance = 0 (rating diff) + 75 (penalty) = 75 > 50.
    await mm.join({
      data: { ...RatingAttr(1000), ...RegionAttr('us-east') },
      formulas: [regionFormula],
    });
    await mm.join({
      data: { ...RatingAttr(1000), ...RegionAttr('eu-west') },
      formulas: [regionFormula],
    });
    expect((await mm.runMatchPass('')).matches).toBe(0);

    // 3s later -> radius = 50 + 30 = 80 > 75 -> match.
    now += 3_000;
    expect((await mm.runMatchPass('')).matches).toBe(1);
  });
});

describe('Matchmaker.runMatchPass with partition (hard-equality)', () => {
  test('never matches across different partition values even after long wait', async () => {
    const kindFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });

    await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [kindFormula],
    });
    await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('beta') },
      formulas: [kindFormula],
    });

    expect((await mm.runMatchPass('')).matches).toBe(0);

    // Saturate radius — even at the cap the partition mismatch keeps them apart.
    now += 60_000;
    expect((await mm.runMatchPass('')).matches).toBe(0);
  });

  test('same-partition participants still match normally with partition active', async () => {
    const kindFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const a = await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [kindFormula],
    });
    const b = await mm.join({
      data: { ...RatingAttr(1020), ...KindAttr('alpha') },
      formulas: [kindFormula],
    });

    expect((await mm.runMatchPass('')).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.participantId));
    expect(aStatus.peers[0]?.participantId).toBe(b.participantId);
  });

  test('partition splits a 3-row queue so only the same-partition pair matches', async () => {
    const kindFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const alphaA = await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [kindFormula],
    });
    const alphaB = await mm.join({
      data: { ...RatingAttr(1020), ...KindAttr('alpha') },
      formulas: [kindFormula],
    });
    const betaOnly = await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('beta') },
      formulas: [kindFormula],
    });

    expect((await mm.runMatchPass('')).matches).toBe(1);
    const alphaAStatus = expectMatched(await mm.status(alphaA.participantId));
    expect(alphaAStatus.peers[0]?.participantId).toBe(alphaB.participantId);
    expect((await mm.status(betaOnly.participantId))?.status).toBe('waiting');
  });

  test('partition-only formula (no numeric terms) is accepted and pairs same-partition participants', async () => {
    const partitionOnly: DistanceFormula = {
      numeric: [],
      partition: [{ tag: KindAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const a = await mm.join({
      data: KindAttr('alpha'),
      formulas: [partitionOnly],
    });
    const b = await mm.join({
      data: KindAttr('alpha'),
      formulas: [partitionOnly],
    });
    await mm.join({ data: KindAttr('beta'), formulas: [partitionOnly] });

    expect((await mm.runMatchPass('')).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.participantId));
    expect(aStatus.peers[0]?.participantId).toBe(b.participantId);
  });
});

describe('Matchmaker per-participant asymmetric formulas', () => {
  test("A's strict formula plus B's looser formula match when both accept the pair", async () => {
    // A insists on a tight rating-only window. B accepts anything (weight 0).
    // The pair satisfies both: A's rating distance is small, B's is 0.
    const tight: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
    };
    const loose: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 0 }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const a = await mm.join({
      data: RatingAttr(1000),
      formulas: [tight],
    });
    const b = await mm.join({
      data: RatingAttr(1010),
      formulas: [loose],
    });

    expect((await mm.runMatchPass('')).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.participantId));
    const bStatus = expectMatched(await mm.status(b.participantId));
    expect(aStatus.matchId).toBe(bStatus.matchId);
  });

  test("B's partition rejects a pair A's formula would have accepted", async () => {
    // A doesn't care about kind. B insists on the same kind. Different kinds -> no match.
    const open: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
    };
    const gated: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });

    await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [open],
    });
    await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('beta') },
      formulas: [gated],
    });

    expect((await mm.runMatchPass('')).matches).toBe(0);
    now += 60_000;
    expect((await mm.runMatchPass('')).matches).toBe(0);
  });
});

describe('Matchmaker OR-of-formulas', () => {
  test("A's [alpha, beta] meets B's [alpha] when both are on alpha", async () => {
    const alpha: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const beta: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const a = await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [alpha, beta],
    });
    const b = await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('alpha') },
      formulas: [alpha],
    });

    expect((await mm.runMatchPass('')).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.participantId));
    expect(aStatus.peers[0]?.participantId).toBe(b.participantId);
  });

  test('OR-of-formulas with no overlap leaves both waiting', async () => {
    const alpha: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const beta: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });

    // A only accepts alpha, B only accepts beta; their kinds differ.
    await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [alpha],
    });
    await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('beta') },
      formulas: [beta],
    });

    expect((await mm.runMatchPass('')).matches).toBe(0);
    now += 60_000;
    expect((await mm.runMatchPass('')).matches).toBe(0);
  });

  test('OR-of-formulas: A on beta, B with [alpha, beta] still matches', async () => {
    const alpha: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const beta: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const a = await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('beta') },
      formulas: [beta],
    });
    const b = await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('beta') },
      formulas: [alpha, beta],
    });

    expect((await mm.runMatchPass('')).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.participantId));
    expect(aStatus.peers[0]?.participantId).toBe(b.participantId);
  });
});

describe('Matchmaker.join asserts', () => {
  test('throws on empty formulas array', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    await expect(
      mm.join({ data: RatingAttr(1000), formulas: [] })
    ).rejects.toThrow();
  });

  test('throws on empty formula (no terms)', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    await expect(
      mm.join({ data: RatingAttr(1000), formulas: [{ numeric: [] }] })
    ).rejects.toThrow();
  });

  test('throws on negative numeric weight', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    await expect(
      mm.join({
        data: RatingAttr(1000),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: -1 }] }],
      })
    ).rejects.toThrow();
  });

  test('throws when required numeric attr is missing', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    await expect(
      mm.join({ data: NameAttr('orphan'), formulas: [SimpleFormula] })
    ).rejects.toThrow();
  });

  test('throws when data contains a non-keyword key', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    await expect(
      mm.join({
        data: { badkey: 1 } as unknown as AttributeState,
        formulas: [SimpleFormula],
      })
    ).rejects.toThrow();
  });

  test(`rejects more than ${String(MAX_FORMULAS_PER_PARTICIPANT)} formulas`, async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const tooMany: DistanceFormula[] = Array.from(
      { length: MAX_FORMULAS_PER_PARTICIPANT + 1 },
      () => SimpleFormula
    );
    await expect(
      mm.join({ data: RatingAttr(1000), formulas: tooMany })
    ).rejects.toThrow();
  });
});

describe('Matchmaker.runMatchPass - bounded snapshot', () => {
  test('emits at most maxPairsPerPass pairs in a single call', async () => {
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      maxPairsPerPass: 3,
      minPassIntervalMs: 0,
    });
    // 10 participants → up to 5 pairs theoretically, but capped at 3.
    for (let i = 0; i < 10; i += 1) {
      await mm.join({
        data: RatingAttr(1000 + i),
        formulas: [SimpleFormula],
      });
    }
    const result = await mm.runMatchPass('');
    expect(result.matches).toBe(3);
  });

  test('drain loop pairs everyone across multiple passes', async () => {
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      maxPairsPerPass: 3,
      minPassIntervalMs: 0,
    });
    for (let i = 0; i < 10; i += 1) {
      await mm.join({
        data: RatingAttr(1000 + i),
        formulas: [SimpleFormula],
      });
    }
    const drained = await mm.runMatchPasses('', { maxPasses: 32 });
    expect(drained.matches).toBe(5);
    expect(drained.passes).toBeGreaterThanOrEqual(2);
  });
});

describe('Matchmaker.runMatchPass - throttle', () => {
  test('second call within minPassIntervalMs short-circuits', async () => {
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
      minPassIntervalMs: 1000,
    });

    await mm.join({ data: RatingAttr(1000), formulas: [SimpleFormula] });
    await mm.join({ data: RatingAttr(1010), formulas: [SimpleFormula] });
    expect((await mm.runMatchPass('')).matches).toBe(1);

    // Fresh joinable pair; same simulated "now" → throttle bites.
    await mm.join({ data: RatingAttr(2000), formulas: [SimpleFormula] });
    await mm.join({ data: RatingAttr(2010), formulas: [SimpleFormula] });
    expect((await mm.runMatchPass('')).matches).toBe(0);

    // Advance past the throttle window → pass goes through.
    now += 2000;
    expect((await mm.runMatchPass('')).matches).toBe(1);
  });
});

describe('Matchmaker.sweepExpired', () => {
  test('no-op when maxWaitSeconds is undefined', async () => {
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });
    await mm.join({ data: RatingAttr(1000), formulas: [SimpleFormula] });
    now += 600_000;
    const result = await mm.sweepExpired('');
    expect(result.removed).toBe(0);
  });

  test('removes waiting rows older than maxWaitSeconds', async () => {
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
      maxWaitSeconds: 60,
      sweepIntervalMs: 0,
    });
    const { participantId } = await mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    now += 120_000;
    const result = await mm.sweepExpired('');
    expect(result.removed).toBe(1);
    expect(await mm.status(participantId)).toBeNull();
  });

  test('respects sweepIntervalMs throttle', async () => {
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
      maxWaitSeconds: 1,
      sweepIntervalMs: 10_000,
    });
    await mm.join({ data: RatingAttr(1000), formulas: [SimpleFormula] });
    now += 2_000;
    const first = await mm.sweepExpired('');
    expect(first.removed).toBe(1);

    // B arrives, ages past maxWaitSeconds, but the sweep throttle bites.
    await mm.join({ data: RatingAttr(2000), formulas: [SimpleFormula] });
    now += 2_000;
    const throttled = await mm.sweepExpired('');
    expect(throttled.removed).toBe(0);

    // Advance past the throttle window.
    now += 10_000;
    const after = await mm.sweepExpired('');
    expect(after.removed).toBe(1);
  });
});

describe('Matchmaker bucketing equivalence', () => {
  test('declared primaryNumericKey produces the same matches as no bucketing', async () => {
    const formulas = [SimpleFormula];

    const plain = await bootHarness();
    const plainMm = new Matchmaker({
      sqlClient: plain.sqlClient,
      minPassIntervalMs: 0,
    });
    for (const r of [1000, 1010, 1100, 1110, 1200, 1210]) {
      await plainMm.join({ data: RatingAttr(r), formulas });
    }
    const plainPairs = await plainMm.runMatchPasses('', { maxPasses: 32 });

    const bucketed = await bootHarness({
      partitionKeys: [],
      primaryNumericKey: RatingAttr.key,
      bucketWidth: 25,
    });
    const bucketedMm = new Matchmaker({
      sqlClient: bucketed.sqlClient,
      minPassIntervalMs: 0,
      bucketWidth: 25,
      primaryNumericKey: RatingAttr.key,
    });
    for (const r of [1000, 1010, 1100, 1110, 1200, 1210]) {
      await bucketedMm.join({ data: RatingAttr(r), formulas });
    }
    const bucketedPairs = await bucketedMm.runMatchPasses('', {
      maxPasses: 32,
    });

    expect(bucketedPairs.matches).toBe(plainPairs.matches);
    expect(plainPairs.matches).toBe(3);
    await plain.db.close();
    await bucketed.db.close();
  });

  test('partition signature shards waiters across declared keys', async () => {
    const partitioned = await bootHarness({
      partitionKeys: [KindAttr.key],
    });
    const mm = new Matchmaker({
      sqlClient: partitioned.sqlClient,
      minPassIntervalMs: 0,
      partitionKeys: [KindAttr.key],
    });
    const formulas = [SimpleFormula];

    const a1 = await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas,
    });
    const a2 = await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('alpha') },
      formulas,
    });
    const b1 = await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('beta') },
      formulas,
    });
    const b2 = await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('beta') },
      formulas,
    });

    const drained = await mm.runMatchPassesAcrossPartitions({
      maxPassesPerPartition: 8,
    });
    expect(drained.matches).toBe(2);
    expect(drained.partitions).toBe(2);
    const a1Status = expectMatched(await mm.status(a1.participantId));
    const b1Status = expectMatched(await mm.status(b1.participantId));
    expect(a1Status.peers[0]?.participantId).toBe(a2.participantId);
    expect(b1Status.peers[0]?.participantId).toBe(b2.participantId);
    expect(a1Status.matchId).not.toBe(b1Status.matchId);
    await partitioned.db.close();
  });
});

describe('Matchmaker partition isolation', () => {
  test('runMatchPass(alpha) leaves beta untouched', async () => {
    const partitioned = await bootHarness({
      partitionKeys: [KindAttr.key],
    });
    const mm = new Matchmaker({
      sqlClient: partitioned.sqlClient,
      minPassIntervalMs: 0,
      partitionKeys: [KindAttr.key],
    });

    const b1 = await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('beta') },
      formulas: [SimpleFormula],
    });
    const b2 = await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('beta') },
      formulas: [SimpleFormula],
    });
    const a1 = await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [SimpleFormula],
    });
    const a2 = await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('alpha') },
      formulas: [SimpleFormula],
    });

    const alphaSig = mm.partitionSignatureFor(KindAttr('alpha'));
    const res = await mm.runMatchPass(alphaSig);
    expect(res.matches).toBe(1);
    expect((await mm.status(a1.participantId))?.status).toBe('matched');
    expect((await mm.status(a2.participantId))?.status).toBe('matched');
    expect((await mm.status(b1.participantId))?.status).toBe('waiting');
    expect((await mm.status(b2.participantId))?.status).toBe('waiting');
    await partitioned.db.close();
  });

  test('per-partition throttle: pass(alpha) does not block pass(beta)', async () => {
    const now = Date.now();
    const partitioned = await bootHarness({
      partitionKeys: [KindAttr.key],
    });
    const mm = new Matchmaker({
      sqlClient: partitioned.sqlClient,
      now: () => now,
      minPassIntervalMs: 1000,
      partitionKeys: [KindAttr.key],
    });

    await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [SimpleFormula],
    });
    await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('alpha') },
      formulas: [SimpleFormula],
    });
    await mm.join({
      data: { ...RatingAttr(1000), ...KindAttr('beta') },
      formulas: [SimpleFormula],
    });
    await mm.join({
      data: { ...RatingAttr(1010), ...KindAttr('beta') },
      formulas: [SimpleFormula],
    });

    const alphaSig = mm.partitionSignatureFor(KindAttr('alpha'));
    const betaSig = mm.partitionSignatureFor(KindAttr('beta'));

    const alphaRes = await mm.runMatchPass(alphaSig);
    expect(alphaRes.matches).toBe(1);

    // Same simulated "now" → if the throttle were global, beta would
    // short-circuit. With per-partition throttle rows, beta runs.
    const betaRes = await mm.runMatchPass(betaSig);
    expect(betaRes.matches).toBe(1);

    // Re-running alpha inside the throttle window still bites.
    await mm.join({
      data: { ...RatingAttr(2000), ...KindAttr('alpha') },
      formulas: [SimpleFormula],
    });
    await mm.join({
      data: { ...RatingAttr(2010), ...KindAttr('alpha') },
      formulas: [SimpleFormula],
    });
    const alphaAgain = await mm.runMatchPass(alphaSig);
    expect(alphaAgain.matches).toBe(0);

    await partitioned.db.close();
  });
});

describe('Matchmaker.sweepMatched', () => {
  test('removes matched rows older than matchedRetentionSeconds', async () => {
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
      minPassIntervalMs: 0,
      matchedRetentionSeconds: 60,
      sweepIntervalMs: 0,
    });

    const a = await mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const b = await mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });
    expect((await mm.runMatchPass('')).matches).toBe(1);
    expect((await mm.status(a.participantId))?.status).toBe('matched');

    // Within retention → no cleanup.
    now += 30_000;
    const fresh = await mm.sweepMatched();
    expect(fresh.removed).toBe(0);
    expect((await mm.status(a.participantId))?.status).toBe('matched');

    // Past retention → both matched rows go.
    now += 60_000;
    const stale = await mm.sweepMatched();
    expect(stale.removed).toBe(2);
    expect(await mm.status(a.participantId)).toBeNull();
    expect(await mm.status(b.participantId)).toBeNull();
  });

  test('no-op when matchedRetentionSeconds is 0', async () => {
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      minPassIntervalMs: 0,
      matchedRetentionSeconds: 0,
    });
    await mm.join({ data: RatingAttr(1000), formulas: [SimpleFormula] });
    await mm.join({ data: RatingAttr(1010), formulas: [SimpleFormula] });
    expect((await mm.runMatchPass('')).matches).toBe(1);
    const res = await mm.sweepMatched();
    expect(res.removed).toBe(0);
  });

  test('respects sweepIntervalMs throttle', async () => {
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
      minPassIntervalMs: 0,
      matchedRetentionSeconds: 1,
      sweepIntervalMs: 10_000,
    });
    await mm.join({ data: RatingAttr(1000), formulas: [SimpleFormula] });
    await mm.join({ data: RatingAttr(1010), formulas: [SimpleFormula] });
    expect((await mm.runMatchPass('')).matches).toBe(1);
    now += 2_000;
    const first = await mm.sweepMatched();
    expect(first.removed).toBe(2);

    await mm.join({ data: RatingAttr(2000), formulas: [SimpleFormula] });
    await mm.join({ data: RatingAttr(2010), formulas: [SimpleFormula] });
    expect((await mm.runMatchPass('')).matches).toBe(1);
    now += 2_000;
    const throttled = await mm.sweepMatched();
    expect(throttled.removed).toBe(0);

    now += 10_000;
    const after = await mm.sweepMatched();
    expect(after.removed).toBe(2);
  });
});

describe('Matchmaker.partitionSignatureFor', () => {
  test('empty partitionKeys → empty signature', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    expect(mm.partitionSignatureFor({})).toBe('');
    expect(mm.partitionSignatureFor({ 'mmtest/kind': 'alpha' })).toBe('');
  });

  test('single key → bare value', async () => {
    const partitioned = await bootHarness({
      partitionKeys: [KindAttr.key],
    });
    const mm = new Matchmaker({
      sqlClient: partitioned.sqlClient,
      partitionKeys: [KindAttr.key],
    });
    expect(mm.partitionSignatureFor({ 'mmtest/kind': 'alpha' })).toBe('alpha');
    expect(mm.partitionSignatureFor({})).toBe('');
    await partitioned.db.close();
  });

  test('multi-key → unit-separator joined value', async () => {
    const partitioned = await bootHarness({
      partitionKeys: [KindAttr.key, RegionAttr.key],
    });
    const mm = new Matchmaker({
      sqlClient: partitioned.sqlClient,
      partitionKeys: [KindAttr.key, RegionAttr.key],
    });
    const sig = mm.partitionSignatureFor({
      'mmtest/kind': 'alpha',
      'mmtest/region': 'us-east',
    });
    expect(sig).toBe(`alpha${String.fromCharCode(0x1f)}us-east`);
    await partitioned.db.close();
  });

  test('JS-computed signature matches DB-computed signature', async () => {
    const partitioned = await bootHarness({
      partitionKeys: [KindAttr.key, RegionAttr.key],
    });
    const mm = new Matchmaker({
      sqlClient: partitioned.sqlClient,
      partitionKeys: [KindAttr.key, RegionAttr.key],
    });
    const data = {
      ...RatingAttr(1000),
      ...KindAttr('alpha'),
      ...RegionAttr('us-east'),
    };
    const joined = await mm.join({ data, formulas: [SimpleFormula] });

    const stored = await partitioned.sqlClient.query<{
      partition_signature: string;
    }>(`SELECT partition_signature FROM matchmaking_queue WHERE id = $1`, [
      joined.participantId,
    ]);
    expect(stored.rows[0]?.partition_signature).toBe(
      mm.partitionSignatureFor(data)
    );
    await partitioned.db.close();
  });
});

describe('Matchmaker schema fingerprint assert', () => {
  test('rejects pass when partitionKeys disagree with migrate()', async () => {
    const partitioned = await bootHarness({
      partitionKeys: [KindAttr.key],
    });
    const mm = new Matchmaker({
      sqlClient: partitioned.sqlClient,
      partitionKeys: [],
    });
    await expect(mm.runMatchPass('')).rejects.toThrow(
      /schema fingerprint mismatch/
    );
    await partitioned.db.close();
  });

  test('matching options → no error', async () => {
    const partitioned = await bootHarness({
      partitionKeys: [KindAttr.key],
      primaryNumericKey: RatingAttr.key,
      bucketWidth: 25,
    });
    const mm = new Matchmaker({
      sqlClient: partitioned.sqlClient,
      partitionKeys: [KindAttr.key],
      primaryNumericKey: RatingAttr.key,
      bucketWidth: 25,
    });
    // Should NOT throw.
    const sig = mm.partitionSignatureFor(KindAttr('alpha'));
    const res = await mm.runMatchPass(sig);
    expect(res.matches).toBe(0);
    await partitioned.db.close();
  });
});
