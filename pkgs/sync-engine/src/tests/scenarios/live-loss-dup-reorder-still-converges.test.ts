import { describe, test } from 'bun:test';
import { RELIABLE_FAULTS } from '../../sim/faults';
import { openSimWorld, type SimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../apps/acme';

async function expectClientsMatchServer(world: SimWorld): Promise<void> {
  for (const client of world.clients.values()) {
    await expectNotesMatchServer(client.db, world.server.db);
  }
}

describe('live loss dup reorder still converges', () => {
  test('lossy live on bob still converges after clear', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 401,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _fault = world.net('bob', 'live').set({ packetLossProbability: 1 });
      await a.mutate(setNote, { id: 'n1', body: 'lost-live' });
      await world.runFor(80);
    }
    await b.disconnect();
    await b.connect();
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'lost-live' });
    await expectClientsMatchServer(world);
  });

  test('dup live on bob converges', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 402,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    using _fault = world.net('bob', 'live').set({ packetReplayProbability: 1 });
    await a.mutate(setNote, { id: 'n1', body: 'dup' });
    await a.mutate(setNote, { id: 'n2', body: 'dup2' });
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'dup' });
    await expectLiveNote(b.db, 'n2', { body: 'dup2' });
  });

  test('reordered live on bob converges', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 403,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    using _fault = world.net('bob', 'live').set({
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
  });

  test('asymmetric: alice reliable, bob lossy+dup+reorder', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 404,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    {
      using _af = world.net('alice', 'live').set(RELIABLE_FAULTS);
      using _bf = world.net('bob', 'live').set({
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
    }
    await world.assertConverged();
    await expectClientsMatchServer(world);
  });

  test('live chaos + sync hold then release converges', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 405,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _fault = world.net('bob', 'live').set({ packetLossProbability: 1 });
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n1', body: 'held' });
      await world.runFor(60);
    }
    await b.disconnect();
    await b.connect();
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'held' });
  });
});
