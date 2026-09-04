import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
  dispatch,
  hold,
  release,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { readClient, readServer } from '../scenario/read-state';

describe('room sim: n-client partition (E-A07)', () => {
  test('selective holds across four clients converge', async () => {
    const ids = ['a', 'b', 'c', 'd'] as const;
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ids) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(hold, 'b');
    await s.apply(hold, 'd');
    await s.apply(dispatch, { clientId: 'a', payload: Increment({}) });
    await s.apply(dispatch, { clientId: 'c', payload: Increment({}) });
    await s.elapse(0);
    expect(counterValue(await readClient(s, 'b'))).toBe(0);
    expect(counterValue(await readClient(s, 'd'))).toBe(0);
    await s.apply(release, 'b');
    await s.apply(release, 'd');

    await expectConverged(s);
    expect(counterValue(await readServer(s))).toBe(2);
    const h = await s.observe(serverHash);
    const hashes = (await s.observe(clientHash)) as Record<string, string>;
    for (const id of ids) {
      expect(counterValue(await readClient(s, id))).toBe(2);
      expect(hashes[id]).toBe(h);
    }
  });
});
