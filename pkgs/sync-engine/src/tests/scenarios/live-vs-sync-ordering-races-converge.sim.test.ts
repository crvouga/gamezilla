import { describe, test } from 'bun:test';
import { type Run, start } from '@pkgs/dst';
import type { SyncSurface } from '../../sim/scenario';
import {
  acmeDraws,
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
  passTime,
  release,
  setNote,
  skewClock,
  syncVirtualHost,
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

type SyncRun = Run<SyncSurface>;

async function applySkews(run: SyncRun, order: ClockOrder): Promise<void> {
  await run.apply(skewClock, 'alice', order.alice);
  await run.apply(skewClock, 'bob', order.bob);
  await run.apply(skewClock, 'server', order.server);
}

async function bootWarmPair(run: SyncRun, skew?: ClockOrder): Promise<void> {
  await run.apply(addClient, { id: 'alice' });
  await run.apply(addClient, { id: 'bob' });
  if (skew !== undefined) await applySkews(run, skew);
  await run.apply(mutate, 'alice', setNote, { id: 'warm', body: 'w' });
  await expectConverged(run);
}

async function liveBeforeSync(run: SyncRun, skew?: ClockOrder): Promise<void> {
  await bootWarmPair(run, skew);

  await run.apply(hold, 'bob', 'sync');
  await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'live-first' });
  await run.apply(passTime, 120);

  await expectConverged(run);
  await expectLiveNoteAt(run, 'bob', 'n1', { body: 'live-first' });
  await expectEveryClientNotesAgree(run);
}

async function syncBeforeLive(run: SyncRun, skew?: ClockOrder): Promise<void> {
  await bootWarmPair(run, skew);

  await run.apply(hold, 'bob', 'live');
  await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'sync-first' });
  await run.apply(passTime, 40);
  // Force pull while live is still held.
  await run.apply(disconnect, 'bob');
  await run.apply(connect, 'bob');
  await run.apply(passTime, 120);
  await expectLiveNoteAt(run, 'bob', 'n1', { body: 'sync-first' });

  await expectConverged(run);
  await expectEveryClientNotesAgree(run);
}

describe('live vs sync ordering races converge', () => {
  test('live before sync (refetch path)', async () => {
    await using run = await start(acmeSystem, {
      seed: 301,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
        rowImageFanout: false,
      }),
      properties: [],
    });

    await liveBeforeSync(run);
  });

  test('sync before live', async () => {
    await using run = await start(acmeSystem, {
      seed: 302,
      host: syncVirtualHost(),
      draws: acmeDraws({
        clientCount: 0,
        rowImageFanout: false,
      }),
      properties: [],
    });

    await syncBeforeLive(run);
  });

  for (const order of RACE_SKEWS) {
    test(`live before sync skew ${order.label}`, async () => {
      await using run = await start(acmeSystem, {
        seed: 310,
        host: syncVirtualHost(),
        draws: acmeDraws({
          clientCount: 0,
          rowImageFanout: false,
        }),
        properties: [],
      });

      await liveBeforeSync(run, order);
    });

    test(`sync before live skew ${order.label}`, async () => {
      await using run = await start(acmeSystem, {
        seed: 320,
        host: syncVirtualHost(),
        draws: acmeDraws({
          clientCount: 0,
          rowImageFanout: false,
        }),
        properties: [],
      });

      await syncBeforeLive(run, order);
    });
  }

  test('stale sync after live fanout', async () => {
    await using run = await start(acmeSystem, {
      seed: 303,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await bootWarmPair(run);

    await run.apply(hold, 'bob', 'sync');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-live' });
    await run.apply(passTime, 120);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'from-live' });

    await expectConverged(run);
    await expectEveryClientNotesAgree(run);
  });

  test('optimistic + held sync converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 304,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'base' });
    await expectConverged(run);

    await run.apply(online, 'bob', false);
    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'bob-pending' });
    await run.apply(hold, 'bob', 'sync');
    await run.apply(online, 'bob', true);
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await run.apply(passTime, 80);
    await run.apply(release, 'bob', 'sync');
    await expectConverged(run);
    await expectEveryClientNotesAgree(run);
  });

  test('optimistic + held live converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 305,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'base' });
    await expectConverged(run);

    await run.apply(hold, 'bob', 'live');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'from-a' });
    await run.apply(passTime, 80);

    await expectConverged(run);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'from-a' });
    await expectEveryClientNotesAgree(run);
  });

  test('live-only partition then heal converges via sync', async () => {
    await using run = await start(acmeSystem, {
      seed: 306,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await bootWarmPair(run);

    await run.apply(partition, 'bob', 'live');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'via-sync' });
    await run.apply(passTime, 40);
    await run.apply(disconnect, 'bob');
    await run.apply(connect, 'bob');
    await run.apply(passTime, 120);
    await expectLiveNoteAt(run, 'bob', 'n1', { body: 'via-sync' });

    await expectConverged(run);
    await expectEveryClientNotesAgree(run);
  });
});
