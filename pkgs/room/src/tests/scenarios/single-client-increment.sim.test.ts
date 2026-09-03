import { describe, expect, test } from 'bun:test';
import { addClient, dispatch, scriptRoom } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: single client increment', () => {
  test('increment converges to server hash', async () => {
    await using run = await scriptRoom(counterSystem, { seed: 1 });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    await expectHashMatch(run, 'alice');
  });
});
