import { describe, expect, test } from 'bun:test';
import {
  connect,
  disconnect,
  dispatch,
  hold,
  release,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: hold during flush (E-A01)', () => {
  test('offline queue + peer hold still converges after heal', async () => {
    await using run = await bootCounter(['alice', 'bob']);

    await run.apply(disconnect, 'alice');
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);

    await run.apply(hold, 'bob');
    await run.apply(connect, 'alice');
    await run.elapse(150);
    expect(counterValue(await readClient(run, 'bob'))).toBe(0);
    await run.apply(release, 'bob');

    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    expect(counterValue(await readClient(run, 'bob'))).toBe(1);
    await expectHashMatch(run, 'alice');
  });
});
