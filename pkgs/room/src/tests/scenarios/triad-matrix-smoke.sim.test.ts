import { describe, expect, test } from 'bun:test';
import {
  clientHash,
  connect,
  connected,
  converge,
  disconnect,
  dispatch,
  down,
  hold,
  passTime,
  release,
  serverHash,
} from '../../sim/scenario';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import { readClient, readServer } from '../scenario/read-state';

describe('room sim: triad matrix smoke (E-A06)', () => {
  test('soft disconnect, hold, and down remain independent', async () => {
    await using run = await bootCounter(['alice', 'bob', 'carol']);

    await run.apply(disconnect, 'alice');
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    expect(((await run.observe(connected)) as string[]).includes('alice')).toBe(
      false
    );
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);

    await run.apply(hold, 'bob');
    expect(((await run.observe(connected)) as string[]).includes('bob')).toBe(
      true
    );
    await run.apply(dispatch, {
      clientId: 'carol',
      payload: Increment({}),
    });
    await run.apply(passTime, 100);
    expect(counterValue(await readClient(run, 'bob'))).not.toBe(1);
    await run.apply(release, 'bob');

    await run.apply(down, 'carol');
    await run.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await run.apply(passTime, 0);
    await run.apply(release, 'carol');

    await run.apply(connect, 'alice');
    await run.apply(disconnect, 'carol');
    await run.apply(connect, 'carol');
    await run.apply(converge);
    expect(counterValue(await readServer(run))).toBe(3);
    expect(counterValue(await readClient(run, 'alice'))).toBe(3);
    const h = await run.observe(serverHash);
    const hashes = (await run.observe(clientHash)) as Record<string, string>;
    expect(hashes['alice']).toBe(h);
    expect(hashes['bob']).toBe(h);
    expect(hashes['carol']).toBe(h);
  });
});
