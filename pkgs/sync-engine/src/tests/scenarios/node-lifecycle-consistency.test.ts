import { describe, expect, test } from 'bun:test';
import {
  expectLiveNote,
  expectNotesMatchServer,
  readLiveNotes,
  setNote,
} from '../../sim/notes-app';
import { openSimWorld, type SimWorld } from '../../sim/world';

async function expectClientsMatchServer(world: SimWorld): Promise<void> {
  for (const client of world.clients.values()) {
    await expectNotesMatchServer(client.db, world.server.db);
  }
}

describe('node lifecycle consistency', () => {
  test('A offline while B writes; A online matches', async () => {
    const world = await openSimWorld({ seed: 201 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      a.lifecycle.setOnline(false);
      await b.mutate(setNote, { id: 'n1', body: 'from-b' });
      await world.runFor(100);
      a.lifecycle.setOnline(true);
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'from-b' });
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('B offline while A writes; B online matches', async () => {
    const world = await openSimWorld({ seed: 202 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      b.lifecycle.setOnline(false);
      await a.mutate(setNote, { id: 'n1', body: 'from-a' });
      await world.runFor(100);
      b.lifecycle.setOnline(true);
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'from-a' });
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('both offline divergent writes then online converge', async () => {
    const world = await openSimWorld({ seed: 203 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      a.lifecycle.setOnline(false);
      b.lifecycle.setOnline(false);
      await a.mutate(setNote, { id: 'shared', body: 'a' });
      await b.mutate(setNote, { id: 'shared', body: 'b' });
      a.lifecycle.setOnline(true);
      b.lifecycle.setOnline(true);
      await world.assertConverged();
      const server = await readLiveNotes(world.server.db);
      const winner = server.find((r) => r.id === 'shared');
      expect(winner?.body === 'a' || winner?.body === 'b').toBe(true);
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('A crash+restart after B wrote rehydrates', async () => {
    const world = await openSimWorld({ seed: 204 });
    try {
      await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await b.mutate(setNote, { id: 'n1', body: 'from-b' });
      await world.assertConverged();
      await world.crashClient('alice');
      const a2 = await world.restartClient('alice');
      await world.assertConverged();
      await expectLiveNote(a2.db, 'n1', { body: 'from-b' });
    } finally {
      await world.dispose();
    }
  });

  test('B crash+restart after A wrote rehydrates', async () => {
    const world = await openSimWorld({ seed: 205 });
    try {
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'n1', body: 'from-a' });
      await world.assertConverged();
      await world.crashClient('bob');
      const b2 = await world.restartClient('bob');
      await world.assertConverged();
      await expectLiveNote(b2.db, 'n1', { body: 'from-a' });
    } finally {
      await world.dispose();
    }
  });

  test('sequential A then B crash/restart after shared state', async () => {
    const world = await openSimWorld({ seed: 206 });
    try {
      const a = await world.addClient({ id: 'alice' });
      await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'n1', body: 'shared' });
      await world.assertConverged();
      await world.crashClient('alice');
      await world.restartClient('alice');
      await world.assertConverged();
      await world.crashClient('bob');
      await world.restartClient('bob');
      await world.assertConverged();
      await expectClientsMatchServer(world);
      await expectLiveNote(world.server.db, 'n1', { body: 'shared' });
    } finally {
      await world.dispose();
    }
  });

  test('server unreachable: both mutate locally then heal converges', async () => {
    const world = await openSimWorld({ seed: 207 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      // Server unreachable = both partitioned from server HTTP/pubsub.
      world.partition('alice', 'bob');
      await a.mutate(setNote, { id: 'n1', body: 'a-local' });
      await b.mutate(setNote, { id: 'n2', body: 'b-local' });
      await world.runFor(100);
      world.healAll();
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'a-local' });
      await expectLiveNote(b.db, 'n2', { body: 'b-local' });
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('staggered: A partitioned, B writes; heal A; B offline writes', async () => {
    const world = await openSimWorld({ seed: 208 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.partition('alice', 'alice');
      await b.mutate(setNote, { id: 'n1', body: 'from-b' });
      await world.runFor(80);
      world.healAll();
      await world.assertConverged();
      await expectLiveNote(a.db, 'n1', { body: 'from-b' });

      b.lifecycle.setOnline(false);
      await b.mutate(setNote, { id: 'n2', body: 'b-queued' });
      await world.runFor(40);
      b.lifecycle.setOnline(true);
      await world.assertConverged();
      await expectLiveNote(a.db, 'n2', { body: 'b-queued' });
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('flip-flop offline and partition around contested note', async () => {
    const world = await openSimWorld({ seed: 209 });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });

      a.lifecycle.setOnline(false);
      await a.mutate(setNote, { id: 'flip', body: 'a1' });
      a.lifecycle.setOnline(true);
      await world.runFor(40);

      world.partition('bob', 'bob');
      await b.mutate(setNote, { id: 'flip', body: 'b1' });
      world.healAll();
      await world.runFor(40);

      b.lifecycle.setOnline(false);
      await a.mutate(setNote, { id: 'flip', body: 'a2' });
      b.lifecycle.setOnline(true);
      await world.assertConverged();

      const server = await readLiveNotes(world.server.db);
      const row = server.find((r) => r.id === 'flip');
      expect(row).toBeDefined();
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });
});
