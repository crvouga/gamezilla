import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  down,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readClientHash,
  readServer,
} from '../scenario/read-state';

describe('room sim: down then heal (E-A02)', () => {
  test('down drops frames; heal + resync converges', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);
    const bobBefore = await readClientHash(s, 'bob');

    await s.apply(down, 'bob');
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.elapse(200);
    expect(await readClientHash(s, 'bob')).toBe(bobBefore);
    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');

    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
