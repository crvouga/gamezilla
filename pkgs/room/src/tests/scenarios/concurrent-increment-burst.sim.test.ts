import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
  dispatch,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { readClient, readServer } from '../scenario/read-state';

describe('room sim: concurrent increment burst (E-B01)', () => {
  test('three clients burst N each → count and hashes match', async () => {
    await using s = await counterSystem.script({
      seed: 42,
      args: { mildFaults: true },
    });
    for (const id of ['alice', 'bob', 'carol']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    const ids = ['alice', 'bob', 'carol'] as const;
    const perClient = 5;
    for (let i = 0; i < perClient; i += 1) {
      for (const id of ids) {
        await s.apply(dispatch, { clientId: id, payload: Increment({}) });
      }
    }
    await expectConverged(s);
    const expected = perClient * ids.length;
    expect(counterValue(await readServer(s))).toBe(expected);
    const h = await s.observe(serverHash);
    const hashes = (await s.observe(clientHash)) as Record<string, string>;
    for (const id of ids) {
      expect(counterValue(await readClient(s, id))).toBe(expected);
      expect(hashes[id]).toBe(h);
    }
  });
});
