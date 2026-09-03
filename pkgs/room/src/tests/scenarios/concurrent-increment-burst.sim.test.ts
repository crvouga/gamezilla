import { describe, expect, test } from 'bun:test';
import { clientHash, dispatch, serverHash } from '../../sim/scenario';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import { readClient, readServer } from '../scenario/read-state';

describe('room sim: concurrent increment burst (E-B01)', () => {
  test('three clients burst N each → count and hashes match', async () => {
    await using run = await bootCounter(['alice', 'bob', 'carol'], {
      mildFaults: true,
    });

    const ids = ['alice', 'bob', 'carol'] as const;
    const perClient = 5;
    for (let i = 0; i < perClient; i += 1) {
      for (const id of ids) {
        await run.apply(dispatch, { clientId: id, payload: Increment({}) });
      }
    }
    await expectConverged(run);
    const expected = perClient * ids.length;
    expect(counterValue(await readServer(run))).toBe(expected);
    const h = await run.observe(serverHash);
    const hashes = (await run.observe(clientHash)) as Record<string, string>;
    for (const id of ids) {
      expect(counterValue(await readClient(run, id))).toBe(expected);
      expect(hashes[id]).toBe(h);
    }
  });
});
