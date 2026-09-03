import { describe, expect, test } from 'bun:test';
import {
  connect,
  disconnect,
  dispatch,
  down,
} from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readClientHash,
  readServer,
} from '../scenario/read-state';

describe('room sim: down then heal (E-A02)', () => {
  test('down drops frames; heal + resync converges', async () => {
    await using run = await bootCounter(['alice', 'bob']);
    const bobBefore = await readClientHash(run, 'bob');

    await run.apply(down, 'bob');
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.elapse(200);
    expect(await readClientHash(run, 'bob')).toBe(bobBefore);
    await run.apply(disconnect, 'bob');
    await run.apply(connect, 'bob');

    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    expect(counterValue(await readClient(run, 'bob'))).toBe(1);
    await expectHashMatch(run, 'alice');
  });
});
