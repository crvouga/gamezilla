import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
  connect,
  disconnect,
  dispatch,
  serverHash,
  setNet,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { readClient, readServer } from '../scenario/read-state';

const LOSSY = {
  latencyMeanMs: 3,
  latencyJitterMs: 4,
  dropProbability: 0.05,
  reorderProbability: 0.2,
  duplicateProbability: 0.1,
};

describe('room sim: lossy profile converge (E-A04)', () => {
  test('mild faults + reorder/dup still converge after soft cycle', async () => {
    const ids = ['alice', 'bob', 'carol'] as const;
    await using s = await counterSystem.script({
      seed: 42,
      args: { mildFaults: true },
    });
    for (const id of ids) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(setNet, { clientId: 'bob', next: LOSSY });
    for (let i = 0; i < 10; i += 1) {
      await s.apply(dispatch, {
        clientId: ids[i % 3]!,
        payload: Increment({}),
      });
    }
    await s.apply(setNet, { clientId: 'bob', next: 'ok' });
    await s.elapse(0);

    for (const id of ids) {
      await s.apply(disconnect, id);
      await s.apply(connect, id);
    }
    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(10);
    const h = await s.observe(serverHash);
    const hashes = (await s.observe(clientHash)) as Record<string, string>;
    for (const id of ids) {
      expect(counterValue(await readClient(s, id))).toBe(10);
      expect(hashes[id]).toBe(h);
    }
  });
});
