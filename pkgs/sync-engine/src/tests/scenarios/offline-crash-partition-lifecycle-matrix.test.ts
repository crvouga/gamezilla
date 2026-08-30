import { describe, expect, test } from 'bun:test';
import { openWorld, type World } from '../../sim/world';
import {
  acmeDomainPack,
  expectLiveNote,
  expectNotesMatchServer,
  readLiveNotes,
  setNote,
} from '../apps/acme';

async function expectClientsMatchServer(world: World): Promise<void> {
  for (const client of world.clients.values()) {
    await expectNotesMatchServer(client.db, world.server.db);
  }
}

describe('offline crash partition lifecycle matrix', () => {
  test('A offline while B writes; A online matches', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 201,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    a.online(false);
    await b.mutate(setNote, { id: 'n1', body: 'from-b' });
    await world.runFor(100);
    a.online(true);
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'from-b' });
    await expectClientsMatchServer(world);
  });

  test('B offline while A writes; B online matches', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 202,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    b.online(false);
    await a.mutate(setNote, { id: 'n1', body: 'from-a' });
    await world.runFor(100);
    b.online(true);
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'from-a' });
    await expectClientsMatchServer(world);
  });

  test('both offline divergent writes then online converge', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 203,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    a.online(false);
    b.online(false);
    await a.mutate(setNote, { id: 'shared', body: 'a' });
    await b.mutate(setNote, { id: 'shared', body: 'b' });
    a.online(true);
    b.online(true);
    await world.assertConverged();
    const server = await readLiveNotes(world.server.db);
    const winner = server.find((r) => r.id === 'shared');
    expect(winner?.body === 'a' || winner?.body === 'b').toBe(true);
    await expectClientsMatchServer(world);
  });

  test('A crash+restart after B wrote rehydrates', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 204,
    });
    await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await b.mutate(setNote, { id: 'n1', body: 'from-b' });
    await world.assertConverged();
    await world.node('alice').crash();
    const a2 = await world.node('alice').restart();
    await world.assertConverged();
    await expectLiveNote(a2!.db, 'n1', { body: 'from-b' });
  });

  test('B crash+restart after A wrote rehydrates', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 205,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'from-a' });
    await world.assertConverged();
    await world.node('bob').crash();
    const b2 = await world.node('bob').restart();
    await world.assertConverged();
    await expectLiveNote(b2!.db, 'n1', { body: 'from-a' });
  });

  test('sequential A then B crash/restart after shared state', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 206,
    });
    const a = await world.addClient({ id: 'alice' });
    await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'shared' });
    await world.assertConverged();
    await world.node('alice').crash();
    await world.node('alice').restart();
    await world.assertConverged();
    await world.node('bob').crash();
    await world.node('bob').restart();
    await world.assertConverged();
    await expectClientsMatchServer(world);
    await expectLiveNote(world.server.db, 'n1', { body: 'shared' });
  });

  test('server unreachable: both mutate locally then heal converges', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 207,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    // Server unreachable = both partitioned from server HTTP/pubsub.
    {
      using _a = world.net('alice').set('down');
      using _b = world.net('bob').set('down');
      await a.mutate(setNote, { id: 'n1', body: 'a-local' });
      await b.mutate(setNote, { id: 'n2', body: 'b-local' });
      await world.runFor(100);
    }
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'a-local' });
    await expectLiveNote(b.db, 'n2', { body: 'b-local' });
    await expectClientsMatchServer(world);
  });

  test('staggered: A partitioned, B writes; heal A; B offline writes', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 208,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _down = world.net('alice').set('down');
      await b.mutate(setNote, { id: 'n1', body: 'from-b' });
      await world.runFor(80);
    }
    await world.assertConverged();
    await expectLiveNote(a.db, 'n1', { body: 'from-b' });

    b.online(false);
    await b.mutate(setNote, { id: 'n2', body: 'b-queued' });
    await world.runFor(40);
    b.online(true);
    await world.assertConverged();
    await expectLiveNote(a.db, 'n2', { body: 'b-queued' });
    await expectClientsMatchServer(world);
  });

  test('flip-flop offline and partition around contested note', async () => {
    await using world = await openWorld({
      domain: acmeDomainPack,
      seed: 209,
    });
    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });

    a.online(false);
    await a.mutate(setNote, { id: 'flip', body: 'a1' });
    a.online(true);
    await world.runFor(40);

    {
      using _down = world.net('bob').set('down');
      await b.mutate(setNote, { id: 'flip', body: 'b1' });
    }
    await world.runFor(40);

    b.online(false);
    await a.mutate(setNote, { id: 'flip', body: 'a2' });
    b.online(true);
    await world.assertConverged();

    const server = await readLiveNotes(world.server.db);
    const row = server.find((r) => r.id === 'flip');
    expect(row).toBeDefined();
    await expectClientsMatchServer(world);
  });
});
