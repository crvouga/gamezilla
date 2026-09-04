import { describe, expect, test } from 'bun:test';
import { addClient, dispatch, hold, release } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readClientHash,
  readServer,
} from '../scenario/read-state';

describe('room sim: partition then heal', () => {
  test('held peer never sees write until heal + converge', async () => {
    await using s = await counterSystem.script({ seed: 3 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectConverged(s);
    const bobBefore = await readClientHash(s, 'bob');

    await s.apply(hold, 'bob');
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.elapse(200);
    expect(counterValue(await readClient(s, 'bob'))).toBe(0);
    expect(await readClientHash(s, 'bob')).toBe(bobBefore);
    await s.apply(release, 'bob');

    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
