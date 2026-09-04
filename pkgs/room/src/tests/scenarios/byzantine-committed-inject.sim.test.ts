import { describe, expect, test } from 'bun:test';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  addClient,
  clock,
  connect,
  disconnect,
  dispatch,
  injectFromServer,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import {
  CounterIncremented,
  counterValue,
  Increment,
} from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: byzantine committed inject (E-D05)', () => {
  test('fake committed on one client heals to server truth', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });

    await s.apply(injectFromServer, {
      clientId: 'bob',
      raw: {
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.committed,
        commandId: 'forged',
        entries: [
          {
            seq: 99,
            event: CounterIncremented({}),
            actor: { id: 'eve', clientId: 'eve' },
            ts: await s.observe(clock),
          },
        ],
      },
    });

    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
