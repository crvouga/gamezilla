// goal:the-bar:3
// goal:works-offline:7
import { describe, expect, test } from 'bun:test';

import type { Run } from '@pkgs/sim';
import {
  addClient,
  exampleSystem,
  expectInSync,
  liveNote,
  mutate,
  netSet,
  type SyncSim,
  setNote,
} from '@pkgs/sync-engine/sim';

const SAMPLES = 20;
const PEER_BUDGET_MS = 200;
const STEP_MS = 5;
const MAX_WAIT_MS = 2000;

const FAULTS = {
  latencyMeanMs: 60,
  latencyJitterMs: 40,
  dropProbability: 0,
  packetReplayProbability: 0,
  reorderWindow: 0,
  partitionProbability: 0,
  healProbability: 0,
} as const;

async function peerSawWrite(
  s: Run<SyncSim>,
  peer: string,
  id: string
): Promise<boolean> {
  try {
    return (await s.read(liveNote, peer, id)) !== null;
  } catch {
    return false;
  }
}

describe('peer-visible sync latency budget', () => {
  test('p95 peer-visible write latency stays under 200ms', async () => {
    await using s = await exampleSystem.run({
      seed: 733,
      args: { clientCount: 0 },
    });
    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
    await expectInSync(s);

    for (const node of ['alice', 'bob'] as const) {
      await s.apply(netSet, node, 'live', FAULTS);
      await s.apply(netSet, node, 'sync', FAULTS);
    }

    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const id = `lat-${String(i)}`;
      await s.apply(mutate, 'alice', setNote, { id, body: id });
      let waited = 0;
      while (!(await peerSawWrite(s, 'bob', id))) {
        if (waited >= MAX_WAIT_MS) {
          throw new Error(
            `peer never saw ${id} within ${String(MAX_WAIT_MS)}ms`
          );
        }
        await s.advanceTime(STEP_MS);
        waited += STEP_MS;
      }
      samples.push(waited);
      await expectInSync(s);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
    // Guard against a vacuous pass: the injected latency must be observed.
    expect(sorted.some((value) => value > 0)).toBe(true);
    expect(p95).toBeLessThan(PEER_BUDGET_MS);
  });
});
