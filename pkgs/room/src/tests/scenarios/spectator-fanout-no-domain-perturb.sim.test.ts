import { describe, expect, test } from 'bun:test';
import type { Run } from '@pkgs/dst';
import {
  addClient,
  clientHash,
  converge,
  dispatch,
  type RoomSurface,
  rosterSize,
  serverHash,
} from '../../sim/scenario';
import { counterValue, Increment } from '../fixtures/counter-module';
import { bootCounter } from '../scenario/boot-counter';
import { readClient, readServer } from '../scenario/read-state';

describe('room sim: spectator fanout (E-H03)', () => {
  test('joining spectators does not change domain hash', async () => {
    await using run = await bootCounter(['alice']);
    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    const domainHash = await readClientHashOrServer(run);

    await run.apply(addClient, { id: 'spec1' });
    await run.apply(addClient, { id: 'spec2' });
    await run.apply(converge);

    expect(counterValue(await readServer(run))).toBe(1);
    expect(counterValue(await readClient(run, 'alice'))).toBe(1);
    expect(await run.observe(serverHash)).toBe(domainHash);
    const hashes = (await run.observe(clientHash)) as Record<string, string>;
    expect(hashes['alice']).toBe(domainHash);
    expect(await run.observe(rosterSize)).toBe(3);
  });
});

async function readClientHashOrServer(run: Run<RoomSurface>): Promise<string> {
  const hashes = (await run.observe(clientHash)) as Record<string, string>;
  return hashes['alice']!;
}
