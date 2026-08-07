import { describe, expect, test } from 'bun:test';
import {
  deleteNote,
  expectNotesMatchServer,
  readLiveNotes,
  readNoteTombstone,
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

type SkewTier = typeof BEHIND | typeof MID | typeof AHEAD;

type ClockOrder = {
  readonly label: string;
  readonly alice: SkewTier;
  readonly bob: SkewTier;
  readonly server: SkewTier;
};

/** All 6 permutations of {behind, mid, ahead} on {alice, bob, server}. */
const CLOCK_ORDERS: readonly ClockOrder[] = [
  { label: 'A < B < S', alice: BEHIND, bob: MID, server: AHEAD },
  { label: 'B < A < S', alice: MID, bob: BEHIND, server: AHEAD },
  { label: 'A < S < B', alice: BEHIND, bob: AHEAD, server: MID },
  { label: 'B < S < A', alice: AHEAD, bob: BEHIND, server: MID },
  { label: 'S < A < B', alice: MID, bob: AHEAD, server: BEHIND },
  { label: 'S < B < A', alice: AHEAD, bob: MID, server: BEHIND },
];

function applyOrder(world: SimWorld, order: ClockOrder): void {
  world.setClockSkew('alice', order.alice);
  world.setClockSkew('bob', order.bob);
  world.setClockSkew(SIM_SERVER_NODE_ID, order.server);
}

async function expectClientsMatchServer(world: SimWorld): Promise<void> {
  for (const client of world.clients.values()) {
    await expectNotesMatchServer(client.db, world.server.db);
  }
}

async function offlineConflictThenConverge(
  world: SimWorld,
  order: ClockOrder
): Promise<void> {
  applyOrder(world, order);
  const a = await world.addClient({ id: 'alice' });
  const b = await world.addClient({ id: 'bob' });
  await world.runFor(50);

  a.lifecycle.setOnline(false);
  b.lifecycle.setOnline(false);
  await a.mutate(setNote, { id: 'shared', body: 'from-a' });
  await b.mutate(setNote, { id: 'shared', body: 'from-b' });
  a.lifecycle.setOnline(true);
  b.lifecycle.setOnline(true);
  await world.assertConverged();

  const server = await readLiveNotes(world.server.db);
  const winner = server.find((r) => r.id === 'shared');
  expect(winner).toBeDefined();
  expect(winner?.body === 'from-a' || winner?.body === 'from-b').toBe(true);
  await expectClientsMatchServer(world);
}

async function onlineOptimisticRace(
  world: SimWorld,
  order: ClockOrder
): Promise<void> {
  applyOrder(world, order);
  const a = await world.addClient({ id: 'alice' });
  const b = await world.addClient({ id: 'bob' });
  await a.mutate(setNote, { id: 'race', body: 'seed' });
  await world.assertConverged();

  // Both online: back-to-back optimistic writes (not Promise.all — simultaneous
  // local apply can race fanout rebase past settle budget).
  await a.mutate(setNote, { id: 'race', body: 'a-online' });
  await b.mutate(setNote, { id: 'race', body: 'b-online' });
  await world.runFor(200);
  await world.assertConverged();
  await expectClientsMatchServer(world);
}

async function aheadDeleteBehindPending(
  world: SimWorld,
  order: ClockOrder
): Promise<void> {
  applyOrder(world, order);
  const a = await world.addClient({ id: 'alice' });
  const b = await world.addClient({ id: 'bob' });

  // Owner is the ahead client so delete is authorized.
  const aheadIsAlice = order.alice > order.bob;
  const owner = aheadIsAlice ? a : b;
  const behind = aheadIsAlice ? b : a;
  await owner.mutate(setNote, { id: 'n1', body: 'owned' });
  await world.assertConverged();

  behind.lifecycle.setOnline(false);
  await behind.mutate(setNote, { id: 'n1', body: 'behind-pending' });
  const del = await owner.mutate(deleteNote, { id: 'n1' });
  expect(del.ok).toBe(true);

  behind.lifecycle.setOnline(true);
  await world.assertConverged();
  await expectClientsMatchServer(world);

  // Domain is consistent: either live with some body, or tombstoned everywhere.
  const server = await readLiveNotes(world.server.db);
  const live = server.find((r) => r.id === 'n1');
  if (live === undefined) {
    for (const client of world.clients.values()) {
      expect(await readNoteTombstone(client.db, 'n1')).not.toBeNull();
    }
  }
}

describe('clock skew consistency', () => {
  for (const order of CLOCK_ORDERS) {
    test(
      `offline conflict converges (${order.label})`,
      async () => {
        const world = await openSimWorld({ seed: 101 });
        try {
          await offlineConflictThenConverge(world, order);
        } finally {
          await world.dispose();
        }
      },
      { timeout: 60_000 }
    );

    test(
      `online optimistic race converges (${order.label})`,
      async () => {
        const world = await openSimWorld({ seed: 102 });
        try {
          await onlineOptimisticRace(world, order);
        } finally {
          await world.dispose();
        }
      },
      { timeout: 60_000 }
    );

    test(
      `ahead delete vs behind pending converges (${order.label})`,
      async () => {
        const world = await openSimWorld({ seed: 103 });
        try {
          await aheadDeleteBehindPending(world, order);
        } finally {
          await world.dispose();
        }
      },
      { timeout: 60_000 }
    );
  }
});
