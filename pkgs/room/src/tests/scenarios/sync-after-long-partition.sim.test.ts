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

describe('room sim: sync after long partition (E-C01)', () => {
  test('many commits behind hold catch up on heal', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(hold, 'bob');
    for (let i = 0; i < 20; i += 1) {
      await s.apply(dispatch, {
        clientId: 'alice',
        payload: Increment({}),
      });
    }
    expect(counterValue(await readClient(s, 'bob'))).toBe(0);
    await s.apply(release, 'bob');
    await s.elapse(0);

    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(20);
    expect(counterValue(await readClient(s, 'alice'))).toBe(20);
    expect(counterValue(await readClient(s, 'bob'))).toBe(20);
    await expectHashMatch(s, 'alice');
  });
});
