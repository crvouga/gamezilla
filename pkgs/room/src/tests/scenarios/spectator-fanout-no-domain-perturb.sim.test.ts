import { describe, expect, test } from 'bun:test';
import type { Script } from '@pkgs/dst';
import {
  addClient,
  clientHash,
  dispatch,
  type RoomSurface,
  rosterSize,
  serverHash,
} from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';
import { counterValue, Increment } from '../fixtures/counter-module';
import { readClient, readServer } from '../scenario/read-state';

describe('room sim: spectator fanout (E-H03)', () => {
  test('joining spectators does not change domain hash', async () => {
    await using s = await counterSystem.script({
      seed: 42,
    });
    for (const id of ['alice']) {
      await s.apply(addClient, { id });
    }
    await expectConverged(s);
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    const domainHash = await readClientHashOrServer(s);

    await s.apply(addClient, { id: 'spec1' });
    await s.apply(addClient, { id: 'spec2' });
    await expectConverged(s);

    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(await s.observe(serverHash)).toBe(domainHash);
    const hashes = await s.observe(clientHash);
    expect(hashes['alice']).toBe(domainHash);
    expect(await s.observe(rosterSize)).toBe(3);
  });
});

async function readClientHashOrServer(s: Script<RoomSurface>): Promise<string> {
  const hashes = (await s.observe(clientHash)) as Record<string, string>;
  return hashes['alice']!;
}
