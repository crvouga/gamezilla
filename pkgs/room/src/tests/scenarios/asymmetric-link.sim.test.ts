import { describe, expect, test } from 'bun:test';
import {
  addClient,
  asymmetricLink,
  dispatch,
  release,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

describe('room sim: asymmetric link (P2)', () => {
  test('toClient hold blocks fanout while toServer still works', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(asymmetricLink, 'bob');
    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await s.elapse(0);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.elapse(120);
    expect(counterValue(await readClient(s, 'bob'))).not.toBe(2);
    await s.apply(release, 'bob');

    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(2);
    expect(counterValue(await readClient(s, 'alice'))).toBe(2);
    expect(counterValue(await readClient(s, 'bob'))).toBe(2);
    await expectHashMatch(s, 'alice');
  });
});
