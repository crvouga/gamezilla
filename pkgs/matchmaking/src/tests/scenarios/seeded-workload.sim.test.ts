import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld } from '../../sim/system';
import {
  expectMatched,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

async function runWorkload(seed: string): Promise<string> {
  await using world = await openMatchmakingWorld({
    seed,
    replicas: 3,
  });
  const replicaIds = [...world.replicas.keys()];
  const participants = [];
  const rng = world.rng.fork('workload');
  for (let i = 0; i < 10; i += 1) {
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
    if (i % 3 === 2) {
      const tickRid = replicaIds[(i + 1) % replicaIds.length]!;
      await world.tick({ maxPassesPerPartition: 2 }, tickRid);
    }
  }
  for (const rid of replicaIds) {
    await world.tick({ maxPassesPerPartition: 8 }, rid);
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

describe('matchmaking sim: seeded workload determinism', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('same seed yields identical match fingerprint twice', async () => {
    const seed = process.env['SIM_SEED'] ?? '42';
    const once = await runWorkload(seed);
    const twice = await runWorkload(seed);
    expect(once).toBe(twice);
  });
});
