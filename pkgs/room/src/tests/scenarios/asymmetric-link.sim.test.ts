import { describe, expect, test } from 'bun:test';
import { asymmetricLink, dispatch, release } from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: asymmetric link (P2)', () => {
  test('toClient hold blocks fanout while toServer still works', async () => {
    await using run = await bootCounter(['alice', 'bob']);

    await run.apply(asymmetricLink, 'bob');
    await run.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await run.elapse(0);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await run.elapse(120);
    expect(counterValue(await readClient(run, 'bob'))).not.toBe(2);
    await run.apply(release, 'bob');

    await expectConverged(run);
    expect(counterValue(await readServer(run))).toBe(2);
    expect(counterValue(await readClient(run, 'alice'))).toBe(2);
    expect(counterValue(await readClient(run, 'bob'))).toBe(2);
    await expectHashMatch(run, 'alice');
  });
});
