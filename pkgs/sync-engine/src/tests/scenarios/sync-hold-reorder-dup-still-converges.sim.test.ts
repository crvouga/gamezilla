import { describe, test } from 'bun:test';
import type { SyncSystemFacade } from '../../sim/system';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

async function expectClientsMatchServer(
  world: SyncSystemFacade
): Promise<void> {
  for (const client of world.clients.values()) {
    await expectNotesMatchServer(client.db, world.server.db);
  }
}

describe('sync hold reorder dup still converges', () => {
  test('held sync still converges after release', async () => {
    await using world = await openAcmeWorld({
      seed: 503,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n1', body: 'held-sync' });
      await world.advance(80);
    }
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'held-sync' });
    await expectClientsMatchServer(world);
  });

  test('reordered sync still converges', async () => {
    await using world = await openAcmeWorld({
      seed: 504,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    using _faults = world.net('bob', 'sync').set({
      oneWayDelayMeanMs: 20,
      oneWayDelayJitterMs: 40,
      reorderWindow: 5,
    });
    await a.mutate(setNote, { id: 'n1', body: 'a' });
    await a.mutate(setNote, { id: 'n2', body: 'b' });
    await a.mutate(setNote, { id: 'n3', body: 'c' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n2', { body: 'b' });
    await expectClientsMatchServer(world);
  });

  test('duplicate sync still converges', async () => {
    await using world = await openAcmeWorld({
      seed: 505,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    using _faults = world
      .net('bob', 'sync')
      .set({ packetReplayProbability: 1 });
    await a.mutate(setNote, { id: 'n1', body: 'dup-sync' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'dup-sync' });
    await expectClientsMatchServer(world);
  });
});
