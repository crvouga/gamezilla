import { describe, expect, test } from 'bun:test';
import {
  converge,
  dispatch,
  hold,
  passTime,
  release,
} from '../../sim/scenario';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: hold during sync (E-A05)', () => {
  test('release mid catch-up still converges', async () => {
    await using run = await bootCounter(['alice', 'bob']);

    await run.apply(hold, 'bob');
    for (let i = 0; i < 12; i += 1) {
      await run.apply(dispatch, {
        clientId: 'alice',
        payload: Increment({}),
      });
    }
    await run.apply(passTime, 0);
    expect(counterValue(await readClient(run, 'bob'))).toBe(0);
    await run.apply(release, 'bob');
    await run.apply(passTime, 0);
    await run.apply(converge);
    expect(counterValue(await readServer(run))).toBe(12);
    expect(counterValue(await readClient(run, 'alice'))).toBe(12);
    expect(counterValue(await readClient(run, 'bob'))).toBe(12);
    await expectHashMatch(run, 'alice');
  });
});
