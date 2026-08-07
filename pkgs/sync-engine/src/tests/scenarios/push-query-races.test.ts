import { describe, test } from 'bun:test';

import { RELIABLE_FAULTS } from '../../sim/faults';
import {
  expectLiveNote,
  expectNotesMatchServer,
  setNote,
} from '../../sim/notes-app';
import {
  openSimWorld,
  SIM_SERVER_NODE_ID,
  type SimWorld,
} from '../../sim/world';

const BEHIND = -60_000;
const MID = 0;
const AHEAD = 60_000;

type ClockOrder = {
  readonly label: string;
  readonly alice: number;
  readonly bob: number;
  readonly server: number;
};

const RACE_SKEWS: readonly ClockOrder[] = [
  { label: 'A < B < S', alice: BEHIND, bob: MID, server: AHEAD },
  { label: 'B < A < S', alice: MID, bob: BEHIND, server: AHEAD },
  { label: 'S < B < A', alice: AHEAD, bob: MID, server: BEHIND },
];

function applySkew(world: SimWorld, order: ClockOrder): void {
  world.setClockSkew('alice', order.alice);
  world.setClockSkew('bob', order.bob);
  world.setClockSkew(SIM_SERVER_NODE_ID, order.server);
}

async function expectClientsMatchServer(world: SimWorld): Promise<void> {
  for (const client of world.clients.values()) {
    await expectNotesMatchServer(client.db, world.server.db);
  }
}

async function liveBeforeSync(world: SimWorld): Promise<void> {
  const a = await world.addClient({ id: 'alice' });
  const b = await world.addClient({ id: 'bob' });
  await a.mutate(setNote, { id: 'warm', body: 'w' });
  await world.assertConverged();

  world.hold('bob', 'sync');
  await a.mutate(setNote, { id: 'n1', body: 'live-first' });
  await world.runFor(120);
  world.release('bob', 'sync');
  await world.assertConverged();
  await expectLiveNote(b.db, 'n1', { body: 'live-first' });
  await expectClientsMatchServer(world);
}

async function syncBeforeLive(world: SimWorld): Promise<void> {
  const a = await world.addClient({ id: 'alice' });
  const b = await world.addClient({ id: 'bob' });
  await a.mutate(setNote, { id: 'warm', body: 'w' });
  await world.assertConverged();

  world.hold('bob', 'live');
  await a.mutate(setNote, { id: 'n1', body: 'sync-first' });
  await world.runFor(40);
  // Force pull while live is still held.
  await b.engine.disconnect();
  await b.engine.connect();
  await world.runFor(120);
  await expectLiveNote(b.db, 'n1', { body: 'sync-first' });
  world.release('bob', 'live');
  await world.assertConverged();
  await expectClientsMatchServer(world);
}

describe('push query races', () => {
  test('live before sync (refetch path)', async () => {
    const world = await openSimWorld({
      seed: 301,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      await liveBeforeSync(world);
    } finally {
      await world.dispose();
    }
  });

  test('sync before live', async () => {
    const world = await openSimWorld({
      seed: 302,
      faults: RELIABLE_FAULTS,
      rowImageFanout: false,
    });
    try {
      await syncBeforeLive(world);
    } finally {
      await world.dispose();
    }
  });

  for (const order of RACE_SKEWS) {
    test(`live before sync skew ${order.label}`, async () => {
      const world = await openSimWorld({
        seed: 310,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        applySkew(world, order);
        await liveBeforeSync(world);
      } finally {
        await world.dispose();
      }
    });

    test(`sync before live skew ${order.label}`, async () => {
      const world = await openSimWorld({
        seed: 320,
        faults: RELIABLE_FAULTS,
        rowImageFanout: false,
      });
      try {
        applySkew(world, order);
        await syncBeforeLive(world);
      } finally {
        await world.dispose();
      }
    });
  }

  test('stale sync after live fanout', async () => {
    const world = await openSimWorld({ seed: 303, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.hold('bob', 'sync');
      await a.mutate(setNote, { id: 'n1', body: 'from-live' });
      await world.runFor(120);
      await expectLiveNote(b.db, 'n1', { body: 'from-live' });
      world.release('bob', 'sync');
      await world.assertConverged();
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('optimistic + held sync converges', async () => {
    const world = await openSimWorld({ seed: 304, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'n1', body: 'base' });
      await world.assertConverged();

      b.lifecycle.setOnline(false);
      await b.mutate(setNote, { id: 'n1', body: 'bob-pending' });
      world.hold('bob', 'sync');
      b.lifecycle.setOnline(true);
      await a.mutate(setNote, { id: 'n1', body: 'from-a' });
      await world.runFor(80);
      world.release('bob', 'sync');
      await world.assertConverged();
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('optimistic + held live converges', async () => {
    const world = await openSimWorld({ seed: 305, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'n1', body: 'base' });
      await world.assertConverged();

      world.hold('bob', 'live');
      await a.mutate(setNote, { id: 'n1', body: 'from-a' });
      await world.runFor(80);
      world.release('bob', 'live');
      await world.assertConverged();
      await expectLiveNote(b.db, 'n1', { body: 'from-a' });
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });

  test('live-only partition then heal converges via sync', async () => {
    const world = await openSimWorld({ seed: 306, faults: RELIABLE_FAULTS });
    try {
      const a = await world.addClient({ id: 'alice' });
      const b = await world.addClient({ id: 'bob' });
      await a.mutate(setNote, { id: 'warm', body: 'w' });
      await world.assertConverged();

      world.partition('bob', 'live');
      await a.mutate(setNote, { id: 'n1', body: 'via-sync' });
      await world.runFor(40);
      await b.engine.disconnect();
      await b.engine.connect();
      await world.runFor(120);
      await expectLiveNote(b.db, 'n1', { body: 'via-sync' });
      world.heal('bob');
      await world.assertConverged();
      await expectClientsMatchServer(world);
    } finally {
      await world.dispose();
    }
  });
});
