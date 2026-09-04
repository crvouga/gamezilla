import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clientHash,
  connect,
  connected,
  disconnect,
  dispatch,
  down,
  hold,
  release,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { readClient, readServer } from '../scenario/read-state';

describe('room sim: triad matrix smoke (E-A06)', () => {
  test('soft disconnect, hold, and down remain independent', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice', 'bob', 'carol']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);

    await s.apply(disconnect, 'alice');
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    expect(((await s.observe(connected)) as string[]).includes('alice')).toBe(
      false
    );
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);

    await s.apply(hold, 'bob');
    expect(((await s.observe(connected)) as string[]).includes('bob')).toBe(
      true
    );
    await s.apply(dispatch, {
      clientId: 'carol',
      payload: Increment({}),
    });
    await s.elapse(100);
    expect(counterValue(await readClient(s, 'bob'))).not.toBe(1);
    await s.apply(release, 'bob');

    await s.apply(down, 'carol');
    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await s.elapse(0);
    await s.apply(release, 'carol');

    await s.apply(connect, 'alice');
    await s.apply(disconnect, 'carol');
    await s.apply(connect, 'carol');
    await expectConverged(s);
    expect(counterValue(await readServer(run))).toBe(3);
    expect(counterValue(await readClient(s, 'alice'))).toBe(3);
    const h = await s.observe(serverHash);
    const hashes = (await s.observe(clientHash)) as Record<string, string>;
    expect(hashes['alice']).toBe(h);
    expect(hashes['bob']).toBe(h);
    expect(hashes['carol']).toBe(h);
  });
});
