import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  connected,
  disconnect,
  dispatch,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: offline dispatch then sync', () => {
  test('optimistic increment flushes after reconnect', async () => {
    await using s = await counterSystem.script({ seed: 4 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    expect(((await s.observe(connected)) as string[]).includes('alice')).toBe(
      false
    );
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);

    await s.elapse(100);
    expect(counterValue(await readClient(s, 'bob'))).not.toBe(1);

    await s.apply(connect, 'alice');
    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
