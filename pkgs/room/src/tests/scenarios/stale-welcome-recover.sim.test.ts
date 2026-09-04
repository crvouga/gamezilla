import { describe, expect, test } from 'bun:test';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  injectFromServer,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: stale welcome recover (E-C02)', () => {
  test('soft disconnect storms + tip inject still converge', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    for (let i = 0; i < 5; i += 1) {
      await s.apply(dispatch, {
        clientId: 'alice',
        payload: Increment({}),
      });
    }

    await s.apply(injectFromServer, {
      clientId: 'bob',
      raw: {
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.welcome,
        fromSeq: 99,
        lastSeq: 99,
        entries: [],
      },
    });

    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await s.apply(disconnect, 'alice');
    await s.apply(connect, 'alice');
    await expectConverged(s);
    expect(counterValue(await readServer(run))).toBe(5);
    expect(counterValue(await readClient(s, 'alice'))).toBe(5);
    expect(counterValue(await readClient(s, 'bob'))).toBe(5);
    await expectHashMatch(s, 'alice');
  });
});
