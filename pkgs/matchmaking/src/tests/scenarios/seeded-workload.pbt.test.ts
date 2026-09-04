import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { defineAction } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

import {
  type MatchmakingSurface,
  matchmaking,
  replicaIds,
  tick,
} from '../../sim/scenario';
import {
  matchFingerprint,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

/** One participant joins a drawn replica with a rating near 1000. */
const joinRating = defineAction<MatchmakingSurface, [number, number]>({
  name: 'joinRating',
  draw: (s) =>
    gen(
      fc.tuple(
        fc.integer({ min: 0, max: 49 }),
        fc.integer({ min: 0, max: replicaIds(s).length - 1 })
      )
    ),
  act: async (s, ratingDelta, replicaIx) => {
    const replicaId = replicaIds(s)[replicaIx];
    const handle = await s.join(
      { data: RatingAttr(1000 + ratingDelta), formulas: [SimpleFormula] },
      replicaId
    );
    s.refs.set(`p${String(s.refs.size)}`, handle.participantId);
  },
});

/** One replica runs a short tick pass. */
const tickOne = defineAction<MatchmakingSurface, [number]>({
  name: 'tickOne',
  draw: (s) => gen(fc.integer({ min: 0, max: replicaIds(s).length - 1 })),
  act: async (s, replicaIx) => {
    await s.tick({ maxPassesPerPartition: 2 }, replicaIds(s)[replicaIx]);
  },
});

type Fingerprint = {
  readonly choices: string;
  readonly matches: string;
};

/** Seeded walk over joins + ticks, drained with a final tick on every replica. */
async function workloadFingerprint(seed: number): Promise<Fingerprint> {
  await using s = await matchmaking.script({ seed, args: { replicas: 2 } });
  const w = await s.walk({
    actions: [joinRating, tickOne],
    steps: 12,
    time: { weight: 1, minMs: 1, maxMs: 10 },
  });
  expect(w.violations).toEqual([]);
  for (const replicaId of await s.observe(replicaIds)) {
    await s.apply(tick, { opts: { maxPassesPerPartition: 4 }, replicaId });
  }
  return {
    choices: JSON.stringify(w.choices),
    matches: await matchFingerprint(s),
  };
}

describe('matchmaking seeded-workload PBT', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test.each([1, 2, 3, 4])(
    'same seed → identical walk choices and match fingerprint (seed=%i)',
    async (seed) => {
      const once = await workloadFingerprint(seed);
      const twice = await workloadFingerprint(seed);
      expect(once).toEqual(twice);
      expect(JSON.parse(once.choices)).not.toHaveLength(0);
    },
    120_000
  );
});
