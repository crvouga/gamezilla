import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  hold,
  release,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: hold during flush (E-A01)', () => {
  test('offline queue + peer hold still converges after heal', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);

    await s.apply(hold, 'bob');
    await s.apply(connect, 'alice');
    await s.elapse(150);
    expect(counterValue(await readClient(s, 'bob'))).toBe(0);
    await s.apply(release, 'bob');

    await expectConverged(s);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
