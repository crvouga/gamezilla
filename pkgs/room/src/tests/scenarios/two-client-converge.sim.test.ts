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

describe('room sim: two client converge', () => {
  test('mutual increments yield equal hashes and roster', async () => {
    await using s = await counterSystem.script({ seed: 2 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(3);
    expect(counterValue(await readClient(s, 'alice'))).toBe(3);
    expect(counterValue(await readClient(s, 'bob'))).toBe(3);
    await expectHashMatch(s, 'alice');
    expect(await s.observe(rosterSize)).toBe(2);
  });
});
