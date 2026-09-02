import { describe, test } from 'bun:test';
import type { SyncSystemWorld } from '../../sim/system';
import { expectLiveNote, expectNotesMatchServer, setNote } from '../apps/acme';
import { openAcmeWorld } from '../apps/acme/system';

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

async function expectClientsMatchServer(world: SyncSystemWorld): Promise<void> {
  for (const client of world.clients.values()) {
    await expectNotesMatchServer(client.db, world.server.db);
  }
}

async function liveBeforeSync(world: SyncSystemWorld): Promise<void> {
  const a = await world.addClient({ id: 'alice' });
  const b = await world.addClient({ id: 'bob' });
  await a.mutate(setNote, { id: 'warm', body: 'w' });
  await world.assertConverged();

  {
    using _hold = world.net('bob', 'sync').set('hold');
    await a.mutate(setNote, { id: 'n1', body: 'live-first' });
    await world.advance(120);
  }
  await world.assertConverged();
  await expectLiveNote(b.db, 'n1', { body: 'live-first' });
  await expectClientsMatchServer(world);
}

async function syncBeforeLive(world: SyncSystemWorld): Promise<void> {
  const a = await world.addClient({ id: 'alice' });
  const b = await world.addClient({ id: 'bob' });
  await a.mutate(setNote, { id: 'warm', body: 'w' });
  await world.assertConverged();

  {
    using _hold = world.net('bob', 'live').set('hold');
    await a.mutate(setNote, { id: 'n1', body: 'sync-first' });
    await world.advance(40);
    // Force pull while live is still held.
    await b.disconnect();
    await b.connect();
    await world.advance(120);
    await expectLiveNote(b.db, 'n1', { body: 'sync-first' });
  }
  await world.assertConverged();
  await expectClientsMatchServer(world);
}

describe('live vs sync ordering races converge', () => {
  test('live before sync (refetch path)', async () => {
    await using world = await openAcmeWorld({
      seed: 301,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await liveBeforeSync(world);
  });

  test('sync before live', async () => {
    await using world = await openAcmeWorld({
      seed: 302,
      knobs: {
        clientCount: 0,
        rowImageFanout: false,
      },
    });

    await syncBeforeLive(world);
  });

  for (const order of RACE_SKEWS) {
    test(`live before sync skew ${order.label}`, async () => {
      await using world = await openAcmeWorld({
        seed: 310,
        knobs: {
          clientCount: 0,
          rowImageFanout: false,
        },
      });

      using _sa = world.node('alice').skewClock(order.alice);
      using _sb = world.node('bob').skewClock(order.bob);
      using _ss = world.node('server').skewClock(order.server);
      await liveBeforeSync(world);
    });

    test(`sync before live skew ${order.label}`, async () => {
      await using world = await openAcmeWorld({
        seed: 320,
        knobs: {
          clientCount: 0,
          rowImageFanout: false,
        },
      });

      using _sa = world.node('alice').skewClock(order.alice);
      using _sb = world.node('bob').skewClock(order.bob);
      using _ss = world.node('server').skewClock(order.server);
      await syncBeforeLive(world);
    });
  }

  test('stale sync after live fanout', async () => {
    await using world = await openAcmeWorld({
      seed: 303,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _hold = world.net('bob', 'sync').set('hold');
      await a.mutate(setNote, { id: 'n1', body: 'from-live' });
      await world.advance(120);
      await expectLiveNote(b.db, 'n1', { body: 'from-live' });
    }
    await world.assertConverged();
    await expectClientsMatchServer(world);
  });

  test('optimistic + held sync converges', async () => {
    await using world = await openAcmeWorld({
      seed: 304,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'base' });
    await world.assertConverged();

    b.online(false);
    await b.mutate(setNote, { id: 'n1', body: 'bob-pending' });
    using _hold = world.net('bob', 'sync').set('hold');
    b.online(true);
    await a.mutate(setNote, { id: 'n1', body: 'from-a' });
    await world.advance(80);
    _hold.restore();
    await world.assertConverged();
    await expectClientsMatchServer(world);
  });

  test('optimistic + held live converges', async () => {
    await using world = await openAcmeWorld({
      seed: 305,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'n1', body: 'base' });
    await world.assertConverged();

    {
      using _hold = world.net('bob', 'live').set('hold');
      await a.mutate(setNote, { id: 'n1', body: 'from-a' });
      await world.advance(80);
    }
    await world.assertConverged();
    await expectLiveNote(b.db, 'n1', { body: 'from-a' });
    await expectClientsMatchServer(world);
  });

  test('live-only partition then heal converges via sync', async () => {
    await using world = await openAcmeWorld({
      seed: 306,
      knobs: {
        clientCount: 0,
      },
    });

    const a = await world.addClient({ id: 'alice' });
    const b = await world.addClient({ id: 'bob' });
    await a.mutate(setNote, { id: 'warm', body: 'w' });
    await world.assertConverged();

    {
      using _down = world.net('bob', 'live').set('down');
      await a.mutate(setNote, { id: 'n1', body: 'via-sync' });
      await world.advance(40);
      await b.disconnect();
      await b.connect();
      await world.advance(120);
      await expectLiveNote(b.db, 'n1', { body: 'via-sync' });
    }
    await world.assertConverged();
    await expectClientsMatchServer(world);
  });
});
