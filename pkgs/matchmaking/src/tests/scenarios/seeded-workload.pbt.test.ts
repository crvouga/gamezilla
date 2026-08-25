import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import { openMatchmakingSimWorld } from '../../sim/world';
import {
  expectMatched,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

async function runShortWorkload(seed: string): Promise<string> {
  await using world = await openMatchmakingSimWorld({
    seed,
    replicas: 2,
  });
  const replicaIds = [...world.replicas.keys()];
  const participants = [];
  const rng = world.rng.fork('workload');
  for (let i = 0; i < 6; i += 1) {
    world.clock.advance(1);
    const rid = replicaIds[i % replicaIds.length]!;
    participants.push(
      await world.join(
        {
          data: RatingAttr(1000 + rng.int(50)),
          formulas: [SimpleFormula],
        },
        rid
      )
    );
    if (i % 2 === 1) {
      await world.tick({ maxPassesPerPartition: 2 }, rid);
    }
  }
  for (const rid of replicaIds) {
    await world.tick({ maxPassesPerPartition: 4 }, rid);
  }
  const parts: string[] = [];
  for (const p of participants) {
    const st = await p.status();
    if (st?.status !== 'matched') {
      parts.push(`${p.participantId}:waiting`);
      continue;
    }
    const matched = expectMatched(st);
    const peers = matched.peers
      .map((x) => x.participantId)
      .sort()
      .join(',');
    parts.push(`${p.participantId}:${matched.matchId}:${peers}`);
  }
  return parts.sort().join('|');
}

describe('matchmaking seeded-workload PBT', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('same generated seed → identical match fingerprint', async () => {
    await assertProperty(
      'matchmaking workload determinism',
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000 }).map(String),
        async (seed) => {
          const once = await runShortWorkload(seed);
          const twice = await runShortWorkload(seed);
          expect(once).toBe(twice);
        }
      ),
      { numRuns: 4 }
    );
  }, 120_000);
});
