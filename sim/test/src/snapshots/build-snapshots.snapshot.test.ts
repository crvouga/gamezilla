/**
 * Build committed system snapshot fixtures via AppDriver DSL.
 * Run: bun run --filter @sim/test snapshot
 */

import { describe, test } from '@jest/globals';
import { captureOpenSimSnapshot } from '../setup/capture-sim-snapshot';
import { openSim } from '../setup/open-sim';
import { writeSimSystemSnapshot } from '../setup/sim-snapshot-fixture';
import { buildBothInSpace } from './builders/both-in-space';
import { buildFriendsPair } from './builders/friends-pair';
import { buildSignedInAlice } from './builders/signed-in-alice';
import { buildSignedInPair } from './builders/signed-in-pair';

type SnapshotSpec = {
  readonly id: string;
  readonly clientIds: readonly string[];
  readonly build: (sim: Awaited<ReturnType<typeof openSim>>) => Promise<void>;
};

const SNAPSHOTS: readonly SnapshotSpec[] = [
  {
    id: 'signed-in-alice',
    clientIds: ['alice'],
    build: buildSignedInAlice,
  },
  {
    id: 'signed-in-pair',
    clientIds: ['alice', 'bob'],
    build: buildSignedInPair,
  },
  {
    id: 'friends-pair',
    clientIds: ['alice', 'bob'],
    build: buildFriendsPair,
  },
  {
    id: 'both-in-space',
    clientIds: ['alice', 'bob'],
    build: buildBothInSpace,
  },
];

describe('build sim system snapshots', () => {
  for (const spec of SNAPSHOTS) {
    test(`write ${spec.id}.json`, async () => {
      await using sim = await openSim(`snapshot:${spec.id}`);
      await spec.build(sim);
      const snapshot = await captureOpenSimSnapshot(sim, spec.clientIds);
      writeSimSystemSnapshot(spec.id, snapshot);
    }, 120_000);
  }
});
