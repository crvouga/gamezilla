import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  passTime,
  setNet,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: down during welcome (E-A03)', () => {
  test('join under down then heal converges', async () => {
    await using run = await bootCounter(['alice']);
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });

    await run.apply(setNet, { clientId: 'bob', next: 'down' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(passTime, 0);
    await run.apply(setNet, { clientId: 'bob', next: 'ok' });

    await run.apply(disconnect, 'bob');
    await run.apply(connect, 'bob');
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(2);
    expect(counterValue(await readClient(run, 'alice'))).toBe(2);
    expect(counterValue(await readClient(run, 'bob'))).toBe(2);
    await expectHashMatch(run, 'alice');
  });
});
