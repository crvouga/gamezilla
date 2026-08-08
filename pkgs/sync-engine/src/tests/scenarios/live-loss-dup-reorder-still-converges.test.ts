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

describe('live loss dup reorder still converges', () => {
  test('lossy live on bob still converges after clear', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 401,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.setFaults('bob', 'live', { packetLossProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'lost-live' });
      await world.runFor(80);
      world.clearFaults('bob');
      await b.engine.disconnect();
      await b.engine.connect();
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'lost-live' });
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('dup live on bob converges', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 402,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      world.setFaults('bob', 'live', { packetReplayProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'dup' });
      await a.mutate(setNote, { id: 'n2', body: 'dup2' });
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'dup' });
      await expectLiveNote(b.db, 'n2', { body: 'dup2' });
    } finally {
      await world.dispose();
    }
  });

  test('reordered live on bob converges', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 403,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      world.setFaults('bob', 'live', {
        oneWayDelayMeanMs: 30,
        oneWayDelayJitterMs: 40,
        reorderWindow: 8,
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

  test('asymmetric: alice reliable, bob lossy+dup+reorder', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 404,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      world.setFaults('alice', 'live', RELIABLE_FAULTS);
      world.setFaults('bob', 'live', {
        packetLossProbability: 0.4,
        packetReplayProbability: 0.5,
        reorderWindow: 5,
        oneWayDelayMeanMs: 15,
        oneWayDelayJitterMs: 25,
      });
      await a.mutate(setNote, { id: 'n1', body: 'one' });
      await b.mutate(setNote, { id: 'n2', body: 'two' });
      await a.mutate(setNote, { id: 'n3', body: 'three' });
      await world.runFor(200);
      world.clearFaults();
      await world.assertConverged();
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('live chaos + sync hold then release converges', async () => {
    const world = await openSimWorld({
      domain: notesDomainPack,
      seed: 405,
      faults: RELIABLE_FAULTS,
    });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.setFaults('bob', 'live', { packetLossProbability: 1 });
      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'held' });
      await world.runFor(60);
      world.release('bob', 'sync');
      world.clearFaults('bob');
      await b.engine.disconnect();
      await b.engine.connect();
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'held' });
    } finally {
      await world.dispose();
    }
  });
});
