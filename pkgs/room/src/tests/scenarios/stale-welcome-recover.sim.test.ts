import { describe, expect, test } from 'bun:test';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../protocol/wire';
import {
  connect,
  disconnect,
  dispatch,
  injectFromServer,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: stale welcome recover (E-C02)', () => {
  test('soft disconnect storms + tip inject still converge', async () => {
    await using run = await bootCounter(['alice', 'bob']);

    for (let i = 0; i < 5; i += 1) {
      await run.apply(dispatch, {
        clientId: 'alice',
        payload: Increment({}),
      });
    }

    await run.apply(injectFromServer, {
      clientId: 'bob',
      raw: {
        v: WIRE_VERSION,
        kind: ROOM_WIRE_KIND.welcome,
        fromSeq: 99,
        lastSeq: 99,
        entries: [],
      },
    });

    await run.apply(disconnect, 'bob');
    await run.apply(connect, 'bob');
    await run.apply(disconnect, 'alice');
    await run.apply(connect, 'alice');
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(5);
    expect(counterValue(await readClient(run, 'alice'))).toBe(5);
    expect(counterValue(await readClient(run, 'bob'))).toBe(5);
    await expectHashMatch(run, 'alice');
  });
});
