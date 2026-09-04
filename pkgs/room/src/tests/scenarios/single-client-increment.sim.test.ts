import { describe, expect, test } from 'bun:test';
import { addClient, dispatch } from '../../sim/scenario';
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
    await using s = await counterSystem.script({ seed: 1 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectConverged(s);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
