import { describe, expect, test } from 'bun:test';
import { type Run, script } from '@pkgs/dst';
import type { SyncSurface } from '../../sim/scenario';
import {
  acmeKnobs,
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
  syncVirtualHost,
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

type SyncRun = Run<SyncSurface>;

async function applyOrder(run: SyncRun, order: ClockOrder): Promise<void> {
  await run.apply(skewClock, 'alice', order.alice);
  await run.apply(skewClock, 'bob', order.bob);
  await run.apply(skewClock, 'server', order.server);
}

async function bootSkewedPair(run: SyncRun, order: ClockOrder): Promise<void> {
  await applyOrder(run, order);
  await run.apply(addClient, { id: 'alice' });
  await run.apply(addClient, { id: 'bob' });
}

async function offlineConflictThenConverge(
  run: SyncRun,
  order: ClockOrder
): Promise<void> {
  await bootSkewedPair(run, order);
  await run.elapse(50);

  await run.apply(online, 'alice', false);
  await run.apply(online, 'bob', false);
  await run.apply(mutate, 'alice', setNote, { id: 'shared', body: 'from-a' });
  await run.apply(mutate, 'bob', setNote, { id: 'shared', body: 'from-b' });
  await run.apply(online, 'alice', true);
  await run.apply(online, 'bob', true);
  await expectConverged(run);

  const server = await run.observe(liveNotes, 'server');
  const winner = server.find((r) => r.id === 'shared');
  expect(winner).toBeDefined();
  expect(winner?.body === 'from-a' || winner?.body === 'from-b').toBe(true);
  await expectEveryClientNotesAgree(run);
}

async function onlineOptimisticRace(
  run: SyncRun,
  order: ClockOrder
): Promise<void> {
  await bootSkewedPair(run, order);
  await run.apply(mutate, 'alice', setNote, { id: 'race', body: 'seed' });
  await expectConverged(run);

  // Both online: back-to-back optimistic writes (not Promise.all — simultaneous
  // local apply can race fanout rebase past settle budget).
  await run.apply(mutate, 'alice', setNote, { id: 'race', body: 'a-online' });
  await run.apply(mutate, 'bob', setNote, { id: 'race', body: 'b-online' });
  await run.elapse(200);
  await expectConverged(run);
  await expectEveryClientNotesAgree(run);
}

async function aheadDeleteBehindPending(
  run: SyncRun,
  order: ClockOrder
): Promise<void> {
  await bootSkewedPair(run, order);

  // Owner is the ahead client so delete is authorized.
  const aheadIsAlice = order.alice > order.bob;
  const owner = aheadIsAlice ? 'alice' : 'bob';
  const behind = aheadIsAlice ? 'bob' : 'alice';
  await run.apply(mutate, owner, setNote, { id: 'n1', body: 'owned' });
  await expectConverged(run);

  // Behind must genuinely stop uploading, otherwise its queued write lands
  // first and steals ownership before the delete.
  await run.apply(disconnect, behind);
  await run.apply(mutate, behind, setNote, {
    id: 'n1',
    body: 'behind-pending',
  });
  await run.apply(mutate, owner, deleteNote, { id: 'n1' });
  expect(await run.observe(lastMutationOk, owner)).toBe(true);

  await run.apply(connect, behind);
  await expectConverged(run);
  await expectEveryClientNotesAgree(run);

  // Domain is consistent: either live with some body, or tombstoned everywhere.
  const server = await run.observe(liveNotes, 'server');
  if (server.find((r) => r.id === 'n1') === undefined) {
    for (const id of await run.observe(clientIds)) {
      expect(await readNoteTombstoneAt(run, id, 'n1')).not.toBeNull();
    }
  }
}

describe('clock skew permutations still converge', () => {
  for (const order of CLOCK_ORDERS) {
    test(
      `offline conflict converges (${order.label})`,
      async () => {
        await using run = await script(acmeSystem, {
          seed: 101,
          host: syncVirtualHost(),
          knobs: acmeKnobs({ clientCount: 0 }),
          properties: [],
        });

        await offlineConflictThenConverge(run, order);
      },
      { timeout: 60_000 }
    );

    test(
      `online optimistic race converges (${order.label})`,
      async () => {
        await using run = await script(acmeSystem, {
          seed: 102,
          host: syncVirtualHost(),
          knobs: acmeKnobs({ clientCount: 0 }),
          properties: [],
        });

        await onlineOptimisticRace(run, order);
      },
      { timeout: 60_000 }
    );

    test(
      `ahead delete vs behind pending converges (${order.label})`,
      async () => {
        await using run = await script(acmeSystem, {
          seed: 103,
          host: syncVirtualHost(),
          knobs: acmeKnobs({ clientCount: 0 }),
          properties: [],
        });

        await aheadDeleteBehindPending(run, order);
      },
      { timeout: 60_000 }
    );
  }
});
