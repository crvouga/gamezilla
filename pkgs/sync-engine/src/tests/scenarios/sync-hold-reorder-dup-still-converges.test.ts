import { describe, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  notesDomainPack,
  setNote,
} from '../../domain-packs/notes-app';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function expectClientsMatchServer(world: SimWorld): Promise<void> {
  for (const client of world.clients.values()) {
    await expectNotesMatchServer(client.db, world.server.db);
  }
}

describe('sync hold reorder dup still converges', () => {
  test('held sync still converges after release', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 503,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'held-sync' });
      await world.runFor(80);
      world.release('bob', 'sync');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'held-sync' });
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('reordered sync still converges', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 504,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      world.setFaults('bob', 'sync', {
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
    } finally {
      await world.dispose();
    }
  });

  test('duplicate sync still converges', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 505,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      world.setFaults('bob', 'sync', { packetReplayProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'dup-sync' });
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'dup-sync' });
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });
});
