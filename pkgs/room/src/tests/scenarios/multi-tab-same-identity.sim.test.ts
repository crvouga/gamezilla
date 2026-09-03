import { describe, expect, test } from 'bun:test';
import { addClient, dispatch, rosterSize } from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: multi-tab same identity (E-C03)', () => {
  test('two tabs same identity fold identically', async () => {
    await using run = await bootCounter([]);
    await run.apply(addClient, {
      id: 'tab1',
      identity: 'alice',
      clientId: 'tab-1',
    });
    await run.apply(addClient, {
      id: 'tab2',
      identity: 'alice',
      clientId: 'tab-2',
    });
    await expectConverged(run);

    await run.apply(dispatch, {
      clientId: 'tab1',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'tab2',
      payload: Increment({}),
    });
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(2);
    expect(counterValue(await readClient(run, 'tab1'))).toBe(2);
    expect(counterValue(await readClient(run, 'tab2'))).toBe(2);
    await expectHashMatch(run, 'tab1');
    expect(await run.observe(rosterSize)).toBe(2);
  });
});
