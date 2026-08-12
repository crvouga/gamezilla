/**
 * Interface-level matchmaking contract. Adapters supply a factory;
 * this suite never imports Postgres / SqlClient / impl internals.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import type { AttributeState } from '@pkgs/attribute';
import { wallIo } from '@pkgs/io';
import { MATCHMAKING_PAYLOAD_LIMITS } from '../interface/payload-limits';
import type { DistanceFormula } from '../interface/types';
import {
  type BootOverrides,
  expectMatched,
  KindAttr,
  type MatchmakingFactory,
  NameAttr,
  pauseForJoinedAtOrdering,
  RatingAttr,
  RegionAttr,
  registerTestCrashHandler,
  SkillAttr,
  UUID_REGEX,
} from './fixtures';

export function runMatchmakingContractTests(factory: MatchmakingFactory): void {
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

  async function boot(overrides?: BootOverrides) {
    return await Promise.resolve(factory(overrides));
  }

  let mm: Awaited<ReturnType<typeof boot>>;
  beforeEach(async () => {
    mm = await boot();
  });

  describe('Matchmaking.join / status / leave', () => {
    test('round-trips participant data through status while waiting', async () => {
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
      expect(
        await mm.status('00000000-0000-0000-0000-000000000000')
      ).toBeNull();
    });

    test('leave removes the row', async () => {
      const { participantId } = await mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      expect((await mm.leave(participantId)).removed).toBe(true);
      expect(await mm.status(participantId)).toBeNull();
    });

    test('ready() is idempotent', async () => {
      await mm.ready();
      await mm.ready();
      const joined = await mm.join({
        data: RatingAttr(900),
        formulas: [SimpleFormula],
      });
      expect(joined.participantId).toBeDefined();
    });
  });

  describe('Matchmaking.join asserts', () => {
    test('throws on empty formulas array', async () => {
      await expect(
        mm.join({ data: RatingAttr(1000), formulas: [] })
      ).rejects.toThrow();
    });

    test('throws on empty formula (no terms)', async () => {
      await expect(
        mm.join({ data: RatingAttr(1000), formulas: [{ numeric: [] }] })
      ).rejects.toThrow();
    });

    test('throws on negative numeric weight', async () => {
      await expect(
        mm.join({
          data: RatingAttr(1000),
          formulas: [{ numeric: [{ tag: RatingAttr, weight: -1 }] }],
        })
      ).rejects.toThrow();
    });

    test('throws when required numeric attr is missing', async () => {
      await expect(
        mm.join({ data: NameAttr('orphan'), formulas: [SimpleFormula] })
      ).rejects.toThrow();
    });

    test('throws when data contains a non-keyword key', async () => {
      await expect(
        mm.join({
          data: { badkey: 1 } as unknown as AttributeState,
          formulas: [SimpleFormula],
        })
      ).rejects.toThrow();
    });
  });

  describe('Matchmaking - status/peers contract', () => {
    test('paired participants see the same matchId and each other as peers', async () => {
      const a = await mm.join({
        data: { ...RatingAttr(1000), ...NameAttr('a') },
        formulas: [SimpleFormula],
      });
      const b = await mm.join({
        data: { ...RatingAttr(1020), ...NameAttr('b') },
        formulas: [SimpleFormula],
      });
      expect((await mm.tick({ maxPassesPerPartition: 4 })).matches).toBe(1);
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
    });

    test('three participants — only the closest pair matches', async () => {
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
      await mm.tick({ maxPassesPerPartition: 4 });
      expect((await mm.status(a.participantId))?.status).toBe('matched');
      expect((await mm.status(b.participantId))?.status).toBe('matched');
      expect((await mm.status(c.participantId))?.status).toBe('waiting');
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
      await mm.join({
        data: { ...RatingAttr(1000), ...SkillAttr(50) },
        formulas: [closeFormula],
      });
      await mm.join({
        data: { ...RatingAttr(1030), ...SkillAttr(80) },
        formulas: [closeFormula],
      });
      expect((await mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
    });

    test('categorical penalty needs wait across regions', async () => {
      const nowRef = { value: 0 };
      const isolated = await boot({ tuning: { now: () => nowRef.value } });
      nowRef.value = wallIo().clock.now();
      const regionFormula: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        categorical: [{ tag: RegionAttr, penalty: 75 }],
      };
      await isolated.join({
        data: { ...RatingAttr(1000), ...RegionAttr('us-east') },
        formulas: [regionFormula],
      });
      await isolated.join({
        data: { ...RatingAttr(1000), ...RegionAttr('eu-west') },
        formulas: [regionFormula],
      });
      expect((await isolated.tick({ maxPassesPerPartition: 1 })).matches).toBe(
        0
      );
      nowRef.value += 30_000;
      expect((await isolated.tick({ maxPassesPerPartition: 1 })).matches).toBe(
        1
      );
    });

    test('partition hard-equality never crosses even at max wait', async () => {
      let now = wallIo().clock.now();
      const isolated = await boot({ tuning: { now: () => now } });
      const kindFormula: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        partition: [{ tag: KindAttr }],
      };
      await isolated.join({
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas: [kindFormula],
      });
      await isolated.join({
        data: { ...RatingAttr(1000), ...KindAttr('beta') },
        formulas: [kindFormula],
      });
      now += 60_000;
      expect((await isolated.tick({ maxPassesPerPartition: 4 })).matches).toBe(
        0
      );
    });

    test('OR-of-formulas pairs when any pair is mutually accepted', async () => {
      const alpha: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        partition: [{ tag: KindAttr }],
      };
      const a = await mm.join({
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas: [alpha, alpha],
      });
      const b = await mm.join({
        data: { ...RatingAttr(1010), ...KindAttr('alpha') },
        formulas: [alpha],
      });
      await mm.tick({ maxPassesPerPartition: 1 });
      expect(
        expectMatched(await mm.status(a.participantId)).peers[0]?.participantId
      ).toBe(b.participantId);
    });
  });

  describe('Matchmaking - partition schema', () => {
    test('declared partitionKeys isolate participants across shards', async () => {
      const partitioned = await boot({
        schema: { partitionKeys: [KindAttr.key] },
      });
      const formulas = [SimpleFormula];
      const a1 = await partitioned.join({
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas,
      });
      const a2 = await partitioned.join({
        data: { ...RatingAttr(1010), ...KindAttr('alpha') },
        formulas,
      });
      const b1 = await partitioned.join({
        data: { ...RatingAttr(1000), ...KindAttr('beta') },
        formulas,
      });
      const b2 = await partitioned.join({
        data: { ...RatingAttr(1010), ...KindAttr('beta') },
        formulas,
      });
      const drained = await partitioned.tick({ maxPassesPerPartition: 8 });
      expect(drained.matches).toBe(2);
      expect(drained.partitions).toBe(2);
      expect(
        expectMatched(await partitioned.status(a1.participantId)).peers[0]
          ?.participantId
      ).toBe(a2.participantId);
      expect(
        expectMatched(await partitioned.status(b1.participantId)).peers[0]
          ?.participantId
      ).toBe(b2.participantId);
    });
  });

  describe('Matchmaking.tick - sweeps', () => {
    test('expiredRemoved reaps waiters older than maxWaitSeconds', async () => {
      const nowRef = { value: 0 };
      const isolated = await boot({
        tuning: { now: () => nowRef.value, maxWaitSeconds: 30 },
      });
      nowRef.value = wallIo().clock.now();
      const { participantId } = await isolated.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      expect((await isolated.tick()).expiredRemoved).toBe(0);
      nowRef.value += 120_000;
      expect((await isolated.tick()).expiredRemoved).toBe(1);
      expect(await isolated.status(participantId)).toBeNull();
    });

    test('matchedRemoved reaps matched rows older than matchedRetentionSeconds', async () => {
      const nowRef = { value: 0 };
      const isolated = await boot({
        tuning: {
          now: () => nowRef.value,
          matchedRetentionSeconds: 10,
        },
      });
      nowRef.value = wallIo().clock.now();
      const a = await isolated.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      const b = await isolated.join({
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
      });
      expect((await isolated.tick({ maxPassesPerPartition: 1 })).matches).toBe(
        1
      );
      nowRef.value += 60_000;
      expect((await isolated.tick()).matchedRemoved).toBe(2);
      expect(await isolated.status(a.participantId)).toBeNull();
      expect(await isolated.status(b.participantId)).toBeNull();
    });

    test('tick on an empty queue is a clean no-op', async () => {
      const res = await mm.tick();
      expect(res).toEqual({
        matches: 0,
        passes: 0,
        partitions: 0,
        expiredRemoved: 0,
        matchedRemoved: 0,
      });
    });
  });

  describe('Matchmaking - leave edge cases', () => {
    test('leave on unknown id returns removed:false', async () => {
      expect(
        (await mm.leave('00000000-0000-0000-0000-000000000000')).removed
      ).toBe(false);
    });

    test('leave on matched participant returns removed:false', async () => {
      const a = await mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      await mm.join({ data: RatingAttr(1010), formulas: [SimpleFormula] });
      await mm.tick({ maxPassesPerPartition: 1 });
      expect((await mm.leave(a.participantId)).removed).toBe(false);
      expectMatched(await mm.status(a.participantId));
    });
  });

  describe('MATCHMAKING_PAYLOAD_LIMITS', () => {
    test('exposes positive caps', () => {
      expect(MATCHMAKING_PAYLOAD_LIMITS.maxDataKeys).toBeGreaterThan(0);
      expect(MATCHMAKING_PAYLOAD_LIMITS.maxFormulas).toBeGreaterThan(0);
      expect(MATCHMAKING_PAYLOAD_LIMITS.maxTermsPerFormula).toBeGreaterThan(0);
      expect(MATCHMAKING_PAYLOAD_LIMITS.maxStringBytes).toBeGreaterThan(0);
      expect(MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes).toBeGreaterThan(0);
    });
  });

  describe('Matchmaking - group matching (groupSize)', () => {
    test('groupSize: 3 forms one match', async () => {
      const a = await mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        groupSize: 3,
      });
      const b = await mm.join({
        data: RatingAttr(1005),
        formulas: [SimpleFormula],
        groupSize: 3,
      });
      const c = await mm.join({
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
        groupSize: 3,
      });
      expect((await mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
      const ma = expectMatched(await mm.status(a.participantId));
      expect(ma.matchId).toBe(
        expectMatched(await mm.status(b.participantId)).matchId
      );
      expect(ma.peers).toHaveLength(2);
      expect(new Set(ma.peers.map((p) => p.participantId))).toEqual(
        new Set([b.participantId, c.participantId])
      );
    });

    test('mixed groupSize never cross-matches', async () => {
      await mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        groupSize: 2,
      });
      await mm.join({
        data: RatingAttr(1005),
        formulas: [SimpleFormula],
        groupSize: 3,
      });
      await mm.join({
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
        groupSize: 3,
      });
      expect((await mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(0);
    });

    test('rejects groupSize out of range', async () => {
      await expect(
        mm.join({
          data: RatingAttr(1000),
          formulas: [SimpleFormula],
          groupSize: 1,
        })
      ).rejects.toThrow();
      await expect(
        mm.join({
          data: RatingAttr(1000),
          formulas: [SimpleFormula],
          groupSize: 17,
        })
      ).rejects.toThrow();
    });
  });

  describe('Matchmaking - per-formula radius', () => {
    test('stricter side bounds the match', async () => {
      await mm.join({
        data: RatingAttr(1000),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
      });
      await mm.join({
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
      expect((await mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(0);
    });

    test('looser per-formula radius lets pair match', async () => {
      await mm.join({
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
      await mm.join({
        data: RatingAttr(1180),
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
      expect((await mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
    });
  });

  describe('Matchmaking - priority', () => {
    test('high-priority joiner is matched before same-bucket FIFO peer', async () => {
      const a = await mm.join({
        data: RatingAttr(1000),
        formulas: [
          {
            numeric: [{ tag: RatingAttr, weight: 1 }],
            radius: {
              baseRadius: 0,
              radiusGrowthPerSecond: 0,
              maxRadius: 0,
            },
          },
        ],
      });
      await pauseForJoinedAtOrdering();
      const b = await mm.join({
        data: RatingAttr(1005),
        formulas: [SimpleFormula],
        priority: 100,
      });
      await pauseForJoinedAtOrdering();
      const c = await mm.join({
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
      });
      expect((await mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
      expect(
        expectMatched(await mm.status(b.participantId)).peers[0]?.participantId
      ).toBe(c.participantId);
      expect((await mm.status(a.participantId))?.status).toBe('waiting');
    });

    test('rejects priority out of range', async () => {
      await expect(
        mm.join({
          data: RatingAttr(1000),
          formulas: [SimpleFormula],
          priority: -1001,
        })
      ).rejects.toThrow();
      await expect(
        mm.join({
          data: RatingAttr(1000),
          formulas: [SimpleFormula],
          priority: 1001,
        })
      ).rejects.toThrow();
    });
  });

  describe('Matchmaking - metadata', () => {
    test('metadata round-trips through waiting and matched status', async () => {
      const meta = { route: 'vip', n: 1 };
      const a = await mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        metadata: meta,
      });
      expect((await mm.status(a.participantId))?.metadata).toEqual(meta);
      await mm.join({
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
        metadata: { other: true },
      });
      await mm.tick({ maxPassesPerPartition: 1 });
      const matched = expectMatched(await mm.status(a.participantId));
      expect(matched.metadata).toEqual(meta);
      expect(matched.peers[0]?.metadata).toEqual({ other: true });
    });

    test('metadata cap enforced', async () => {
      await expect(
        mm.join({
          data: RatingAttr(1000),
          formulas: [SimpleFormula],
          metadata: { pad: 'x'.repeat(2000) },
        })
      ).rejects.toThrow();
    });
  });

  describe('Matchmaking - updateFormulas', () => {
    test('widening criteria mid-wait allows a previously-rejected peer', async () => {
      const tight: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        radius: { baseRadius: 5, radiusGrowthPerSecond: 0, maxRadius: 5 },
      };
      const open: DistanceFormula = {
        numeric: [{ tag: RatingAttr, weight: 1 }],
        radius: {
          baseRadius: 200,
          radiusGrowthPerSecond: 0,
          maxRadius: 200,
        },
      };
      const a = await mm.join({
        data: RatingAttr(1000),
        formulas: [tight],
      });
      await mm.join({ data: RatingAttr(1050), formulas: [open] });
      expect((await mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(0);
      expect((await mm.updateFormulas(a.participantId, [open])).updated).toBe(
        true
      );
      expect((await mm.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
    });

    test('returns updated:false for unknown / matched', async () => {
      expect(
        (
          await mm.updateFormulas('00000000-0000-0000-0000-000000000000', [
            SimpleFormula,
          ])
        ).updated
      ).toBe(false);
      const a = await mm.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
      });
      await mm.join({ data: RatingAttr(1010), formulas: [SimpleFormula] });
      await mm.tick({ maxPassesPerPartition: 1 });
      expect(
        (await mm.updateFormulas(a.participantId, [SimpleFormula])).updated
      ).toBe(false);
    });
  });
}
