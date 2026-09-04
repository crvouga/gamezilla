import { describe, expect, test } from 'bun:test';
import type { Script } from '@pkgs/dst';
import type { SyncSurface } from '../../sim/scenario';
import {
  acmeSystem,
  addClient,
  clientIds,
  connect,
  deleteNote,
  disconnect,
  expectConverged,
  expectEveryClientNotesAgree,
  lastMutationOk,
  liveNotes,
  mutate,
  online,
  readNoteTombstoneAt,
  setNote,
  skewClock,
} from '../apps/acme';

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

type SyncScript = Script<SyncSurface>;

async function applyOrder(s: SyncScript, order: ClockOrder): Promise<void> {
  await s.apply(skewClock, 'alice', order.alice);
  await s.apply(skewClock, 'bob', order.bob);
  await s.apply(skewClock, 'server', order.server);
}

async function bootSkewedPair(s: SyncScript, order: ClockOrder): Promise<void> {
  await applyOrder(s, order);
  await s.apply(addClient, { id: 'alice' });
  await s.apply(addClient, { id: 'bob' });
}

async function offlineConflictThenConverge(
  s: SyncScript,
  order: ClockOrder
): Promise<void> {
  await bootSkewedPair(s, order);
  await s.elapse(50);

  await s.apply(online, 'alice', false);
  await s.apply(online, 'bob', false);
  await s.apply(mutate, 'alice', setNote, { id: 'shared', body: 'from-a' });
  await s.apply(mutate, 'bob', setNote, { id: 'shared', body: 'from-b' });
  await s.apply(online, 'alice', true);
  await s.apply(online, 'bob', true);
  await expectConverged(s);

  const server = await s.observe(liveNotes, 'server');
  const winner = server.find((r) => r.id === 'shared');
  expect(winner).toBeDefined();
  expect(winner?.body === 'from-a' || winner?.body === 'from-b').toBe(true);
  await expectEveryClientNotesAgree(s);
}

async function onlineOptimisticRace(
  s: SyncScript,
  order: ClockOrder
): Promise<void> {
  await bootSkewedPair(s, order);
  await s.apply(mutate, 'alice', setNote, { id: 'race', body: 'seed' });
  await expectConverged(s);

  // Both online: back-to-back optimistic writes (not Promise.all — simultaneous
  // local apply can race fanout rebase past settle budget).
  await s.apply(mutate, 'alice', setNote, { id: 'race', body: 'a-online' });
  await s.apply(mutate, 'bob', setNote, { id: 'race', body: 'b-online' });
  await s.elapse(200);
  await expectConverged(s);
  await expectEveryClientNotesAgree(s);
}

async function aheadDeleteBehindPending(
  s: SyncScript,
  order: ClockOrder
): Promise<void> {
  await bootSkewedPair(s, order);

  // Owner is the ahead client so delete is authorized.
  const aheadIsAlice = order.alice > order.bob;
  const owner = aheadIsAlice ? 'alice' : 'bob';
  const behind = aheadIsAlice ? 'bob' : 'alice';
  await s.apply(mutate, owner, setNote, { id: 'n1', body: 'owned' });
  await expectConverged(s);

  // Behind must genuinely stop uploading, otherwise its queued write lands
  // first and steals ownership before the delete.
  await s.apply(disconnect, behind);
  await s.apply(mutate, behind, setNote, {
    id: 'n1',
    body: 'behind-pending',
  });
  await s.apply(mutate, owner, deleteNote, { id: 'n1' });
  expect(await s.observe(lastMutationOk, owner)).toBe(true);

  await s.apply(connect, behind);
  await expectConverged(s);
  await expectEveryClientNotesAgree(s);

  // Domain is consistent: either live with some body, or tombstoned everywhere.
  const server = await s.observe(liveNotes, 'server');
  if (server.find((r) => r.id === 'n1') === undefined) {
    for (const id of await s.observe(clientIds)) {
      expect(await readNoteTombstoneAt(s, id, 'n1')).not.toBeNull();
    }
  }
}

describe('clock skew permutations still converge', () => {
  for (const order of CLOCK_ORDERS) {
    test(
      `offline conflict converges (${order.label})`,
      async () => {
        await using s = await acmeSystem.script({
          seed: 101,
          args: { clientCount: 0 },
        });

        await offlineConflictThenConverge(s, order);
      },
      { timeout: 60_000 }
    );

    test(
      `online optimistic race converges (${order.label})`,
      async () => {
        await using s = await acmeSystem.script({
          seed: 102,
          args: { clientCount: 0 },
        });

        await onlineOptimisticRace(s, order);
      },
      { timeout: 60_000 }
    );

    test(
      `ahead delete vs behind pending converges (${order.label})`,
      async () => {
        await using s = await acmeSystem.script({
          seed: 103,
          args: { clientCount: 0 },
        });

        await aheadDeleteBehindPending(s, order);
      },
      { timeout: 60_000 }
    );
  }
});
