import { describe, expect, test } from 'bun:test';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  clock,
  connect,
  disconnect,
  dispatch,
  injectFromServer,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import {
  CounterIncremented,
  counterValue,
  Increment,
} from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: byzantine committed inject (E-D05)', () => {
  test('fake committed on one client heals to server truth', async () => {
    await using run = await bootCounter(['alice', 'bob']);

    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });

    await run.apply(injectFromServer, {
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
            ts: await run.observe(clock),
          },
        ],
      },
    });

    await run.apply(disconnect, 'bob');
    await run.apply(connect, 'bob');
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    expect(counterValue(await readClient(run, 'bob'))).toBe(1);
    await expectHashMatch(run, 'alice');
  });
});
