import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  connected,
  disconnect,
  dispatch,
  passTime,
  scriptRoom,
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
    await using run = await scriptRoom(counterSystem, { seed: 4 });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await expectConverged(run);

    await run.apply(disconnect, 'alice');
    expect(((await run.observe(connected)) as string[]).includes('alice')).toBe(
      false
    );
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);

    await run.apply(passTime, 100);
    expect(counterValue(await readClient(run, 'bob'))).not.toBe(1);

    await run.apply(connect, 'alice');
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    expect(counterValue(await readClient(run, 'bob'))).toBe(1);
    await expectHashMatch(run, 'alice');
  });
});
