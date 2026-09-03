import { describe, expect, test } from 'bun:test';
import {
  addClient,
  dispatch,
  hold,
  release,
} from '../../sim/scenario';
import { openRoom } from '../scenario/open-room';
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
    await using run = await openRoom(counterSystem, { seed: 3 });
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await expectConverged(run);
    const bobBefore = await readClientHash(run, 'bob');

    await run.apply(hold, 'bob');
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.elapse(200);
    expect(counterValue(await readClient(run, 'bob'))).toBe(0);
    expect(await readClientHash(run, 'bob')).toBe(bobBefore);
    await run.apply(release, 'bob');

    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    expect(counterValue(await readClient(run, 'bob'))).toBe(1);
    await expectHashMatch(run, 'alice');
  });
});
