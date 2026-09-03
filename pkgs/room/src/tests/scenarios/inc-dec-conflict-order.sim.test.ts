import { describe, expect, test } from 'bun:test';
import { dispatch, passTime, setNet } from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Decrement, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
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
    await using run = await bootCounter(['alice', 'bob']);

    await run.apply(setNet, { clientId: 'alice', next: JITTER });
    await run.apply(setNet, { clientId: 'bob', next: JITTER });
    for (let i = 0; i < 6; i += 1) {
      await run.apply(dispatch, {
        clientId: 'alice',
        payload: Increment({}),
      });
      await run.apply(dispatch, {
        clientId: 'bob',
        payload: Decrement({}),
      });
    }
    await run.apply(passTime, 0);
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(0);
    expect(counterValue(await readClient(run, 'alice'))).toBe(0);
    await expectHashMatch(run, 'alice');
    await expectHashMatch(run, 'bob');
  });
});
