import { describe, expect, test } from 'bun:test';
import {
  clientHash,
  converge,
  dispatch,
  hold,
  passTime,
  release,
  serverHash,
} from '../../sim/scenario';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import { readClient, readServer } from '../scenario/read-state';

describe('room sim: n-client partition (E-A07)', () => {
  test('selective holds across four clients converge', async () => {
    const ids = ['a', 'b', 'c', 'd'] as const;
    await using run = await bootCounter(ids);

    await run.apply(hold, 'b');
    await run.apply(hold, 'd');
    await run.apply(dispatch, { clientId: 'a', payload: Increment({}) });
    await run.apply(dispatch, { clientId: 'c', payload: Increment({}) });
    await run.apply(passTime, 0);
    expect(counterValue(await readClient(run, 'b'))).toBe(0);
    expect(counterValue(await readClient(run, 'd'))).toBe(0);
    await run.apply(release, 'b');
    await run.apply(release, 'd');

    await run.apply(converge);
    expect(counterValue(await readServer(run))).toBe(2);
    const h = await run.observe(serverHash);
    const hashes = (await run.observe(clientHash)) as Record<string, string>;
    for (const id of ids) {
      expect(counterValue(await readClient(run, id))).toBe(2);
      expect(hashes[id]).toBe(h);
    }
  });
});
