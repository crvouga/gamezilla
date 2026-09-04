import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  setNet,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: down during welcome (E-A03)', () => {
  test('join under down then heal converges', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });

    await s.apply(setNet, { clientId: 'bob', next: 'down' });
    await s.apply(addClient, { id: 'bob' });
    await s.elapse(0);
    await s.apply(setNet, { clientId: 'bob', next: 'ok' });

    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await expectConverged(s);
    expect(counterValue(await readServer(run))).toBe(2);
    expect(counterValue(await readClient(s, 'alice'))).toBe(2);
    expect(counterValue(await readClient(s, 'bob'))).toBe(2);
    await expectHashMatch(s, 'alice');
  });
});
