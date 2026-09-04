import { describe, expect, test } from 'bun:test';
import { addClient, dispatch, setNet } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Decrement, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

const JITTER = {
  latencyMeanMs: 5,
  latencyJitterMs: 8,
  dropProbability: 0,
};

describe('room sim: inc-dec conflict order (E-B04)', () => {
  test('final count matches server fold under jitter', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(setNet, { clientId: 'alice', next: JITTER });
    await s.apply(setNet, { clientId: 'bob', next: JITTER });
    for (let i = 0; i < 6; i += 1) {
      await s.apply(dispatch, {
        clientId: 'alice',
        payload: Increment({}),
      });
      await s.apply(dispatch, {
        clientId: 'bob',
        payload: Decrement({}),
      });
    }
    await s.elapse(0);
    await expectConverged(s);
    expect(counterValue(await readServer(run))).toBe(0);
    expect(counterValue(await readClient(s, 'alice'))).toBe(0);
    await expectHashMatch(s, 'alice');
    await expectHashMatch(s, 'bob');
  });
});
