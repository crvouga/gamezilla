import { describe, expect, test } from 'bun:test';
import { addClient, dispatch, hold, release } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: hold during sync (E-A05)', () => {
  test('release mid catch-up still converges', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(hold, 'bob');
    for (let i = 0; i < 12; i += 1) {
      await s.apply(dispatch, {
        clientId: 'alice',
        payload: Increment({}),
      });
    }
    await s.elapse(0);
    expect(counterValue(await readClient(s, 'bob'))).toBe(0);
    await s.apply(release, 'bob');
    await s.elapse(0);
    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(12);
    expect(counterValue(await readClient(s, 'alice'))).toBe(12);
    expect(counterValue(await readClient(s, 'bob'))).toBe(12);
    await expectHashMatch(s, 'alice');
  });
});
