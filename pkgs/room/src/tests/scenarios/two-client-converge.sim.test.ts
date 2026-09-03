import { describe, expect, test } from 'bun:test';
import {
  addClient,
  dispatch,
  rosterSize,
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

describe('room sim: two client converge', () => {
  test('mutual increments yield equal hashes and roster', async () => {
    await using run = await scriptRoom(counterSystem, { seed: 2 });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(3);
    expect(counterValue(await readClient(run, 'alice'))).toBe(3);
    expect(counterValue(await readClient(run, 'bob'))).toBe(3);
    await expectHashMatch(run, 'alice');
    expect(await run.observe(rosterSize)).toBe(2);
  });
});
