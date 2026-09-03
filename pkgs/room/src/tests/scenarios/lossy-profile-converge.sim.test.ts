import { describe, expect, test } from 'bun:test';
import {
  clientHash,
  connect,
  converge,
  disconnect,
  dispatch,
  passTime,
  serverHash,
  setNet,
} from '../../sim/scenario';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
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
    await using run = await bootCounter(ids, { mildFaults: true });

    await run.apply(setNet, { clientId: 'bob', next: LOSSY });
    for (let i = 0; i < 10; i += 1) {
      await run.apply(dispatch, {
        clientId: ids[i % 3]!,
        payload: Increment({}),
      });
    }
    await run.apply(setNet, { clientId: 'bob', next: 'ok' });
    await run.apply(passTime, 0);

    for (const id of ids) {
      await run.apply(disconnect, id);
      await run.apply(connect, id);
    }
    await run.apply(converge);
    expect(counterValue(await readServer(run))).toBe(10);
    const h = await run.observe(serverHash);
    const hashes = (await run.observe(clientHash)) as Record<string, string>;
    for (const id of ids) {
      expect(counterValue(await readClient(run, id))).toBe(10);
      expect(hashes[id]).toBe(h);
    }
  });
});
