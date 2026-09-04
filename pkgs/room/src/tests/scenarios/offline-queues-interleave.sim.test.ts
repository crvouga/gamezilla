import { describe, expect, test } from 'bun:test';
import { addClient, connect, disconnect, dispatch } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: offline queues interleave (E-B03)', () => {
  test('both offline queues flush; server order wins', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob', 'carol']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(disconnect, 'bob');
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'carol',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(s, 'carol'))).toBe(1);

    await s.apply(connect, 'alice');
    await s.apply(connect, 'bob');
    await expectConverged(s);
    expect(counterValue(await readServer(run))).toBe(4);
    expect(counterValue(await readClient(s, 'alice'))).toBe(4);
    await expectHashMatch(s, 'alice');
    await expectHashMatch(s, 'bob');
    await expectHashMatch(s, 'carol');
  });
});
