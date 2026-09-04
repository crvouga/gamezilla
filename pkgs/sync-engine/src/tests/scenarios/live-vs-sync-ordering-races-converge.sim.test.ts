import { describe, test } from 'bun:test';
import type { Script } from '@pkgs/dst';
import type { SyncSurface } from '../../sim/scenario';
import {
  acmeSystem,
  addClient,
  connect,
  disconnect,
  expectConverged,
  expectEveryClientNotesAgree,
  expectLiveNoteAt,
  hold,
  mutate,
  online,
  partition,
  release,
  setNote,
  skewClock,
} from '../apps/acme';

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

type SyncScript = Script<SyncSurface>;

async function applySkews(s: SyncScript, order: ClockOrder): Promise<void> {
  await s.apply(skewClock, 'alice', order.alice);
  await s.apply(skewClock, 'bob', order.bob);
  await s.apply(skewClock, 'server', order.server);
}

async function bootWarmPair(s: SyncScript, skew?: ClockOrder): Promise<void> {
  await s.apply(addClient, { id: 'alice' });
  await s.apply(addClient, { id: 'bob' });
  if (skew !== undefined) await applySkews(s, skew);
  await s.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
  await expectConverged(s);
}

async function liveBeforeSync(s: SyncScript, skew?: ClockOrder): Promise<void> {
  await bootWarmPair(s, skew);

  await s.apply(hold, 'bob', 'sync');
  await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'live-first' });
  await s.elapse(120);

  await expectConverged(s);
  await expectLiveNoteAt(s, 'bob', 'n1', { body: 'live-first' });
  await expectEveryClientNotesAgree(s);
}

async function syncBeforeLive(s: SyncScript, skew?: ClockOrder): Promise<void> {
  await bootWarmPair(s, skew);

  await s.apply(hold, 'bob', 'live');
  await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'sync-first' });
  await s.elapse(40);
  // Force pull while live is still held.
  await s.apply(disconnect, 'bob');
  await s.apply(connect, 'bob');
  await s.elapse(120);
  await expectLiveNoteAt(s, 'bob', 'n1', { body: 'sync-first' });

  await expectConverged(s);
  await expectEveryClientNotesAgree(s);
}

describe('live vs sync ordering races converge', () => {
  test('live before sync (refetch path)', async () => {
    await using s = await acmeSystem.script({
      seed: 301,
      args: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await liveBeforeSync(s);
  });

  test('sync before live', async () => {
    await using s = await acmeSystem.script({
      seed: 302,
      args: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await syncBeforeLive(s);
  });

  for (const order of RACE_SKEWS) {
    test(`live before sync skew ${order.label}`, async () => {
      await using s = await acmeSystem.script({
        seed: 310,
        args: {
          clientCount: 0,
          rowImageFanout: false,
        },
      });

      await liveBeforeSync(s, order);
    });

    test(`sync before live skew ${order.label}`, async () => {
      await using s = await acmeSystem.script({
        seed: 320,
        args: {
          clientCount: 0,
          rowImageFanout: false,
        },
      });

      await syncBeforeLive(s, order);
    });
  }

  test('stale sync after live fanout', async () => {
    await using s = await acmeSystem.script({
      seed: 303,
      args: { clientCount: 0 },
    });

    await bootWarmPair(s);

    await s.apply(hold, 'bob', 'sync');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-live' });
    await s.elapse(120);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'from-live' });

    await expectConverged(s);
    await expectEveryClientNotesAgree(s);
  });

  test('optimistic + held sync converges', async () => {
    await using s = await acmeSystem.script({
      seed: 304,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'base' });
    await expectConverged(s);

    await s.apply(online, 'bob', false);
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'bob-pending' });
    await s.apply(hold, 'bob', 'sync');
    await s.apply(online, 'bob', true);
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await s.elapse(80);
    await s.apply(release, 'bob', 'sync');
    await expectConverged(s);
    await expectEveryClientNotesAgree(s);
  });

  test('optimistic + held live converges', async () => {
    await using s = await acmeSystem.script({
      seed: 305,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'base' });
    await expectConverged(s);

    await s.apply(hold, 'bob', 'live');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await s.elapse(80);

    await expectConverged(s);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'from-a' });
    await expectEveryClientNotesAgree(s);
  });

  test('live-only partition then heal converges via sync', async () => {
    await using s = await acmeSystem.script({
      seed: 306,
      args: { clientCount: 0 },
    });

    await bootWarmPair(s);

    await s.apply(partition, 'bob', 'live');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'via-sync' });
    await s.elapse(40);
    await s.apply(disconnect, 'bob');
    await s.apply(connect, 'bob');
    await s.elapse(120);
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'via-sync' });

    await expectConverged(s);
    await expectEveryClientNotesAgree(s);
  });
});
