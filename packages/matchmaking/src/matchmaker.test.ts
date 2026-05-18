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
import { Matchmaker } from './matchmaker';
import { migrate } from './migrate';
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

const GameAttr = testNs('game', (v): string => {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error('mmtest/game must be a non-empty string');
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

async function bootHarness(): Promise<Harness> {
  const db = await PGlite.create();
  const sqlClient = createPgliteSqlClient(db);
  await migrate({ sqlClient });
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
  test('round-trips player data through status while waiting', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const joined = await mm.join({
      data: { ...RatingAttr(1500), ...NameAttr('alice') },
      formulas: [SimpleFormula],
    });
    expect(typeof joined.playerId).toBe('string');

    const status = await mm.status(joined.playerId);
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
    const { playerId } = await mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const result = await mm.leave(playerId);
    expect(result.removed).toBe(true);
    expect(await mm.status(playerId)).toBeNull();
  });
});

describe('Matchmaker.runMatchPass', () => {
  test('empty queue early-returns with zero matches', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const result = await mm.runMatchPass();
    expect(result.matches).toBe(0);
  });

  test('pairs two close-rated players and surfaces shared matchId via status', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    const a = await mm.join({
      data: { ...RatingAttr(1000), ...NameAttr('a') },
      formulas: [SimpleFormula],
    });
    const b = await mm.join({
      data: { ...RatingAttr(1020), ...NameAttr('b') },
      formulas: [SimpleFormula],
    });

    const result = await mm.runMatchPass();
    expect(result.matches).toBe(1);

    const aStatus = expectMatched(await mm.status(a.playerId));
    const bStatus = expectMatched(await mm.status(b.playerId));
    expect(aStatus.matchId).toMatch(UUID_REGEX);
    expect(aStatus.matchId).toBe(bStatus.matchId);
    expect(aStatus.opponents.map((p) => p.playerId)).toEqual([b.playerId]);
    expect(bStatus.opponents.map((p) => p.playerId)).toEqual([a.playerId]);
    expect(
      aStatus.opponents.map(
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
    expect((await mm.runMatchPass()).matches).toBe(0);

    // Advance the simulated clock by 30s -> radius = 50 + 30*10 = 350.
    // Each player needs at least |1200-1000|=200 of mutual radius. Both
    // are 30s old in the matchmaker's eyes, so they qualify.
    now += 30_000;
    const result = await mm.runMatchPass();
    expect(result.matches).toBe(1);
  });

  test('concurrent passes do not double-match the same player', async () => {
    const mm = new Matchmaker({ sqlClient: h.sqlClient });
    await mm.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    await mm.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });

    const [a, b] = await Promise.all([mm.runMatchPass(), mm.runMatchPass()]);
    expect(a.matches + b.matches).toBe(1);
  });

  test('three players in the queue only match the closest pair', async () => {
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

    expect((await mm.runMatchPass()).matches).toBe(1);
    expect((await mm.status(a.playerId))?.status).toBe('matched');
    expect((await mm.status(b.playerId))?.status).toBe('matched');
    expect((await mm.status(c.playerId))?.status).toBe('waiting');
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
    expect((await mm.runMatchPass()).matches).toBe(1);
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
    expect((await mm.runMatchPass()).matches).toBe(0);

    // Advance 5s -> radius = 50 + 50 = 100; distance 80 now fits.
    now += 5_000;
    expect((await mm.runMatchPass()).matches).toBe(1);
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
    expect((await mm.runMatchPass()).matches).toBe(0);

    // 3s later -> radius = 50 + 30 = 80 > 75 -> match.
    now += 3_000;
    expect((await mm.runMatchPass()).matches).toBe(1);
  });
});

describe('Matchmaker.runMatchPass with game partition', () => {
  test('never matches across different games even after long wait', async () => {
    const gameFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });

    await mm.join({
      data: { ...RatingAttr(1000), ...GameAttr('chess') },
      formulas: [gameFormula],
    });
    await mm.join({
      data: { ...RatingAttr(1000), ...GameAttr('go') },
      formulas: [gameFormula],
    });

    expect((await mm.runMatchPass()).matches).toBe(0);

    // Saturate radius — even at the cap the partition mismatch keeps them apart.
    now += 60_000;
    expect((await mm.runMatchPass()).matches).toBe(0);
  });

  test('same-game players still match normally with partition active', async () => {
    const gameFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const a = await mm.join({
      data: { ...RatingAttr(1000), ...GameAttr('chess') },
      formulas: [gameFormula],
    });
    const b = await mm.join({
      data: { ...RatingAttr(1020), ...GameAttr('chess') },
      formulas: [gameFormula],
    });

    expect((await mm.runMatchPass()).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.playerId));
    expect(aStatus.opponents[0]?.playerId).toBe(b.playerId);
  });

  test('partition splits a 3-player queue so only the same-game pair matches', async () => {
    const gameFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const chessA = await mm.join({
      data: { ...RatingAttr(1000), ...GameAttr('chess') },
      formulas: [gameFormula],
    });
    const chessB = await mm.join({
      data: { ...RatingAttr(1020), ...GameAttr('chess') },
      formulas: [gameFormula],
    });
    const goP = await mm.join({
      data: { ...RatingAttr(1010), ...GameAttr('go') },
      formulas: [gameFormula],
    });

    expect((await mm.runMatchPass()).matches).toBe(1);
    const chessAStatus = expectMatched(await mm.status(chessA.playerId));
    expect(chessAStatus.opponents[0]?.playerId).toBe(chessB.playerId);
    expect((await mm.status(goP.playerId))?.status).toBe('waiting');
  });

  test('partition-only formula (no numeric terms) is accepted and pairs same-game players', async () => {
    const partitionOnly: DistanceFormula = {
      numeric: [],
      partition: [{ tag: GameAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const a = await mm.join({
      data: GameAttr('chess'),
      formulas: [partitionOnly],
    });
    const b = await mm.join({
      data: GameAttr('chess'),
      formulas: [partitionOnly],
    });
    await mm.join({ data: GameAttr('go'), formulas: [partitionOnly] });

    expect((await mm.runMatchPass()).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.playerId));
    expect(aStatus.opponents[0]?.playerId).toBe(b.playerId);
  });
});

describe('Matchmaker per-player asymmetric formulas', () => {
  test("A's strict formula plus B's looser formula match when both accept the pair", async () => {
    // A insists on a tight rating-only window. B is a free-for-all (any rating).
    // The pair satisfies both: A's rating distance is 0, B's is 0.
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

    expect((await mm.runMatchPass()).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.playerId));
    const bStatus = expectMatched(await mm.status(b.playerId));
    expect(aStatus.matchId).toBe(bStatus.matchId);
  });

  test("B's partition rejects a pair A's formula would have accepted", async () => {
    // A doesn't care about game. B insists on the same game. Different games -> no match.
    const open: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
    };
    const gated: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });

    await mm.join({
      data: { ...RatingAttr(1000), ...GameAttr('chess') },
      formulas: [open],
    });
    await mm.join({
      data: { ...RatingAttr(1010), ...GameAttr('go') },
      formulas: [gated],
    });

    expect((await mm.runMatchPass()).matches).toBe(0);
    now += 60_000;
    expect((await mm.runMatchPass()).matches).toBe(0);
  });
});

describe('Matchmaker OR-of-formulas', () => {
  test("A's [chess, battleship] meets B's [chess] when both play chess", async () => {
    const chess: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    const battleship: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const a = await mm.join({
      data: { ...RatingAttr(1000), ...GameAttr('chess') },
      formulas: [chess, battleship],
    });
    const b = await mm.join({
      data: { ...RatingAttr(1010), ...GameAttr('chess') },
      formulas: [chess],
    });

    expect((await mm.runMatchPass()).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.playerId));
    expect(aStatus.opponents[0]?.playerId).toBe(b.playerId);
  });

  test('OR-of-formulas with no overlap leaves both waiting', async () => {
    const chess: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    const battleship: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    let now = Date.now();
    const mm = new Matchmaker({
      sqlClient: h.sqlClient,
      now: () => now,
    });

    // A only plays chess, B only plays battleship; their game data differs.
    await mm.join({
      data: { ...RatingAttr(1000), ...GameAttr('chess') },
      formulas: [chess],
    });
    await mm.join({
      data: { ...RatingAttr(1010), ...GameAttr('battleship') },
      formulas: [battleship],
    });

    expect((await mm.runMatchPass()).matches).toBe(0);
    now += 60_000;
    expect((await mm.runMatchPass()).matches).toBe(0);
  });

  test('OR-of-formulas: A on battleship, B with [chess, battleship] still matches', async () => {
    const chess: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    const battleship: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: GameAttr }],
    };
    const mm = new Matchmaker({ sqlClient: h.sqlClient });

    const a = await mm.join({
      data: { ...RatingAttr(1000), ...GameAttr('battleship') },
      formulas: [battleship],
    });
    const b = await mm.join({
      data: { ...RatingAttr(1010), ...GameAttr('battleship') },
      formulas: [chess, battleship],
    });

    expect((await mm.runMatchPass()).matches).toBe(1);
    const aStatus = expectMatched(await mm.status(a.playerId));
    expect(aStatus.opponents[0]?.playerId).toBe(b.playerId);
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
});
