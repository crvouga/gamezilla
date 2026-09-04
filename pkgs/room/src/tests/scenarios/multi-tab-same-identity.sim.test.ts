import { describe, expect, test } from 'bun:test';
import { addClient, dispatch, rosterSize } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: multi-tab same identity (E-C03)', () => {
  test('two tabs same identity fold identically', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    await expectConverged(s);
    await s.apply(addClient, {
      id: 'tab1',
      identity: 'alice',
      clientId: 'tab-1',
    });
    await s.apply(addClient, {
      id: 'tab2',
      identity: 'alice',
      clientId: 'tab-2',
    });
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'tab1',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'tab2',
      payload: Increment({}),
    });
    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(2);
    expect(counterValue(await readClient(s, 'tab1'))).toBe(2);
    expect(counterValue(await readClient(s, 'tab2'))).toBe(2);
    await expectHashMatch(s, 'tab1');
    expect(await s.observe(rosterSize)).toBe(2);
  });
});
